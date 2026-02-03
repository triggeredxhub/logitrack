import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AddOrderItemInput } from '@/lib/types';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/orders/[id]/items - Add item to an order
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id: orderId } = await context.params;
    const body: AddOrderItemInput = await request.json();

    // Check if order exists and is in PENDING status
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: 'Can only add items to PENDING orders' },
        { status: 400 }
      );
    }

    // Validate item
    if (!body.productName || !body.sku || !body.quantity || body.unitPrice === undefined) {
      return NextResponse.json(
        { success: false, error: 'productName, sku, quantity, and unitPrice are required' },
        { status: 400 }
      );
    }

    if (body.quantity <= 0) {
      return NextResponse.json(
        { success: false, error: 'Quantity must be greater than 0' },
        { status: 400 }
      );
    }

    // Check inventory if batch ID is provided
    if (body.inventoryBatchId) {
      const batch = await prisma.inventoryBatch.findUnique({
        where: { id: body.inventoryBatchId },
      });

      if (!batch) {
        return NextResponse.json(
          { success: false, error: 'Inventory batch not found' },
          { status: 404 }
        );
      }

      if (batch.quantity < body.quantity) {
        return NextResponse.json(
          { success: false, error: `Insufficient inventory. Available: ${batch.quantity}` },
          { status: 400 }
        );
      }
    }

    const totalPrice = body.quantity * body.unitPrice;

    // Create order item
    const item = await prisma.orderItem.create({
      data: {
        orderId,
        inventoryBatchId: body.inventoryBatchId || null,
        productName: body.productName,
        sku: body.sku,
        quantity: body.quantity,
        unitPrice: body.unitPrice,
        totalPrice,
      },
    });

    // Deduct inventory if batch ID is provided
    if (body.inventoryBatchId) {
      await prisma.inventoryBatch.update({
        where: { id: body.inventoryBatchId },
        data: {
          quantity: {
            decrement: body.quantity,
          },
        },
      });
    }

    // Update order total
    await prisma.order.update({
      where: { id: orderId },
      data: {
        totalAmount: {
          increment: totalPrice,
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          ...item,
          unitPrice: parseFloat(item.unitPrice.toString()),
          totalPrice: parseFloat(item.totalPrice.toString()),
        },
        message: 'Item added to order',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error adding order item:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add order item' },
      { status: 500 }
    );
  }
}

// DELETE /api/orders/[id]/items - Remove item from an order (requires itemId in body)
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id: orderId } = await context.params;
    const body = await request.json();
    const { itemId } = body;

    if (!itemId) {
      return NextResponse.json(
        { success: false, error: 'itemId is required' },
        { status: 400 }
      );
    }

    // Check if order exists and is in PENDING status
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: 'Can only remove items from PENDING orders' },
        { status: 400 }
      );
    }

    // Check if item exists
    const item = await prisma.orderItem.findUnique({
      where: { id: itemId },
    });

    if (!item || item.orderId !== orderId) {
      return NextResponse.json(
        { success: false, error: 'Order item not found' },
        { status: 404 }
      );
    }

    // Restore inventory if batch ID exists
    if (item.inventoryBatchId) {
      await prisma.inventoryBatch.update({
        where: { id: item.inventoryBatchId },
        data: {
          quantity: {
            increment: item.quantity,
          },
        },
      });
    }

    // Delete item
    await prisma.orderItem.delete({
      where: { id: itemId },
    });

    // Update order total
    await prisma.order.update({
      where: { id: orderId },
      data: {
        totalAmount: {
          decrement: parseFloat(item.totalPrice.toString()),
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Item removed from order',
    });
  } catch (error) {
    console.error('Error removing order item:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove order item' },
      { status: 500 }
    );
  }
}
