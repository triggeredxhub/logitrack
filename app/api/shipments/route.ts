import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { syncShipmentStatus, syncAllActiveShipments, createTracxClient } from '@/lib/tracx-client';

// GET /api/shipments - List all shipments with filtering
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { trackingNumber: { contains: search, mode: 'insensitive' } },
        { order: { orderNumber: { contains: search, mode: 'insensitive' } } },
        { recipientName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    const [shipments, total] = await Promise.all([
      prisma.shipment.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              customerName: true,
              totalAmount: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.shipment.count({ where }),
    ]);

    return NextResponse.json({
      shipments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching shipments:', error);
    return NextResponse.json({ error: 'Failed to fetch shipments' }, { status: 500 });
  }
}

// POST /api/shipments - Create a new shipment or sync all
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // If action is 'sync-all', sync all active shipments
    if (body.action === 'sync-all') {
      const client = await createTracxClient();
      if (!client) {
        return NextResponse.json(
          { error: 'No active TracxLogis configuration found' },
          { status: 400 }
        );
      }

      const result = await syncAllActiveShipments();
      return NextResponse.json({
        message: 'Sync completed',
        ...result,
      });
    }

    // Create new shipment
    const { orderId, trackingNumber, carrier, estimatedDelivery, recipientName, recipientAddress, weight } = body;

    if (!orderId || !trackingNumber) {
      return NextResponse.json(
        { error: 'Order ID and tracking number are required' },
        { status: 400 }
      );
    }

    // Check if order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { shipment: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.shipment) {
      return NextResponse.json(
        { error: 'Order already has a shipment' },
        { status: 400 }
      );
    }

    // Check if tracking number already exists
    const existingShipment = await prisma.shipment.findUnique({
      where: { trackingNumber },
    });

    if (existingShipment) {
      return NextResponse.json(
        { error: 'Tracking number already exists' },
        { status: 400 }
      );
    }

    const shipment = await prisma.shipment.create({
      data: {
        orderId,
        trackingNumber,
        carrier: carrier || 'TracxLogis',
        status: 'PENDING',
        estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : null,
        recipientName: recipientName || order.customerName,
        recipientAddress: recipientAddress || order.shippingAddress,
        weight: weight ? parseFloat(weight) : null,
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
          },
        },
      },
    });

    // Update order status to SHIPPED
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'SHIPPED' },
    });

    return NextResponse.json(shipment, { status: 201 });
  } catch (error) {
    console.error('Error creating shipment:', error);
    return NextResponse.json({ error: 'Failed to create shipment' }, { status: 500 });
  }
}
