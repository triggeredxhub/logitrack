import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ORDER_STATUS_TRANSITIONS, OrderStatus } from '@/lib/types';

type RouteContext = { params: Promise<{ id: string }> };

// PUT /api/orders/[id]/status - Update order status with lifecycle validation
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const newStatus = body.status as OrderStatus;

    if (!newStatus) {
      return NextResponse.json(
        { success: false, error: 'Status is required' },
        { status: 400 }
      );
    }

    // Check if order exists
    const existingOrder = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    const currentStatus = existingOrder.status as OrderStatus;

    // Validate status transition
    const allowedTransitions = ORDER_STATUS_TRANSITIONS[currentStatus];
    if (!allowedTransitions.includes(newStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot transition from ${currentStatus} to ${newStatus}. Allowed transitions: ${allowedTransitions.join(', ') || 'none'}`,
        },
        { status: 400 }
      );
    }

    // Handle inventory restoration on cancellation
    if (newStatus === 'CANCELLED' && currentStatus !== 'CANCELLED') {
      for (const item of existingOrder.items) {
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
      }
    }

    // Update order status
    const order = await prisma.order.update({
      where: { id },
      data: {
        status: newStatus,
      },
      include: {
        items: true,
      },
    });

    return NextResponse.json({
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
      message: `Order status updated to ${newStatus}`,
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update order status' },
      { status: 500 }
    );
  }
}

// GET /api/orders/[id]/status - Get available status transitions
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    const order = await prisma.order.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    const currentStatus = order.status as OrderStatus;
    const availableTransitions = ORDER_STATUS_TRANSITIONS[currentStatus];

    return NextResponse.json({
      success: true,
      data: {
        currentStatus,
        availableTransitions,
      },
    });
  } catch (error) {
    console.error('Error fetching order status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch order status' },
      { status: 500 }
    );
  }
}
