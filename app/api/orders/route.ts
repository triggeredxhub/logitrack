import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CreateOrderInput, ORDER_CHANNELS, OrderStatus } from "@/lib/types";

function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${timestamp}-${random}`;
}

// GET /api/orders - List all orders
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const channel = searchParams.get("channel") || "";

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { customerEmail: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (channel) {
      where.channel = channel;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: true,
          shipment: true,
        },
        orderBy: { orderDate: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    const formattedOrders = orders.map((order) => ({
      ...order,
      totalAmount: parseFloat(order.totalAmount.toString()),
      items: order.items.map((item) => ({
        ...item,
        unitPrice: parseFloat(item.unitPrice.toString()),
        totalPrice: parseFloat(item.totalPrice.toString()),
      })),
    }));

    return NextResponse.json({
      success: true,
      data: formattedOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch orders" },
      { status: 500 },
    );
  }
}

// POST /api/orders - Create a new order
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body: CreateOrderInput = await request.json();

    // Validate channel
    if (!body.channel || !ORDER_CHANNELS.includes(body.channel)) {
      return NextResponse.json(
        {
          success: false,
          error: `Channel must be one of: ${ORDER_CHANNELS.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Validate items
    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Order must have at least one item" },
        { status: 400 },
      );
    }

    // Validate each item
    for (const item of body.items) {
      if (
        !item.productName ||
        !item.sku ||
        !item.quantity ||
        item.unitPrice === undefined
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Each item must have productName, sku, quantity, and unitPrice",
          },
          { status: 400 },
        );
      }
      if (item.quantity <= 0) {
        return NextResponse.json(
          { success: false, error: "Item quantity must be greater than 0" },
          { status: 400 },
        );
      }
    }

    // Calculate total amount
    const totalAmount = body.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );

    if (!body.customerName || !body.customerPhone || !body.shippingAddress) {
      return NextResponse.json(
        {
          success: false,
          error: "Customer name, phone, and shipping address are required",
        },
        { status: 400 },
      );
    }

    // Create order with items
    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        channel: body.channel,
        status: "PENDING" as OrderStatus,
        customerName: body.customerName || null,
        customerEmail: body.customerEmail || null,
        customerPhone: body.customerPhone || null,
        shippingAddress: body.shippingAddress || null,
        totalAmount,
        currency: body.currency || "PHP",
        orderDate: body.orderDate ? new Date(body.orderDate) : new Date(),
        items: {
          create: body.items.map((item) => ({
            inventoryBatchId: item.inventoryBatchId || null,
            productName: item.productName,
            sku: item.sku,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    // Deduct inventory if batch IDs are provided
    for (const item of body.items) {
      if (item.inventoryBatchId) {
        await prisma.inventoryBatch.update({
          where: { id: item.inventoryBatchId },
          data: {
            quantity: {
              decrement: item.quantity,
            },
          },
        });
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          ...order,
          totalAmount: parseFloat(order.totalAmount.toString()),
          items: order.items.map((item) => ({
            ...item,
            unitPrice: parseFloat(item.unitPrice.toString()),
            totalPrice: parseFloat(item.totalPrice.toString()),
          })),
        },
        message: "Order created successfully",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create order" },
      { status: 500 },
    );
  }
}
