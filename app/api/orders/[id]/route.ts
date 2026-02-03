import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { UpdateOrderInput } from '@/lib/types';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/orders/[id] - Get a single order with items
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
      include: {
        items: {
          include: {
            inventoryBatch: {
              include: {
                product: true,
              },
            },
          },
        },
        shipment: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

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
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch order' },
      { status: 500 }
    );
  }
}

// PUT /api/orders/[id] - Update order details (not status)
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
    const body: UpdateOrderInput = await request.json();

    // Check if order exists
    const existingOrder = await prisma.order.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // Don't allow status updates through this endpoint
    if (body.status) {
      return NextResponse.json(
        { success: false, error: 'Use /api/orders/[id]/status to update order status' },
        { status: 400 }
      );
    }

    const order = await prisma.order.update({
      where: { id },
      data: {
        ...(body.customerName !== undefined && { customerName: body.customerName }),
        ...(body.customerEmail !== undefined && { customerEmail: body.customerEmail }),
        ...(body.customerPhone !== undefined && { customerPhone: body.customerPhone }),
        ...(body.shippingAddress !== undefined && { shippingAddress: body.shippingAddress }),
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
      message: 'Order updated successfully',
    });
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update order' },
      { status: 500 }
    );
  }
}

// DELETE /api/orders/[id] - Delete an order
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

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

    // Only allow deletion of PENDING or CANCELLED orders
    if (!['PENDING', 'CANCELLED'].includes(existingOrder.status)) {
      return NextResponse.json(
        { success: false, error: 'Can only delete PENDING or CANCELLED orders' },
        { status: 400 }
      );
    }

    // Restore inventory if order was pending (items were already deducted)
    if (existingOrder.status === 'PENDING') {
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

    // Delete order (cascades to items)
    await prisma.order.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Order deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete order' },
      { status: 500 }
    );
  }
}
