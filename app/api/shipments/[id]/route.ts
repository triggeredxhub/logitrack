import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { syncShipmentStatus } from '@/lib/tracx-client';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/shipments/[id] - Get shipment details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const shipment = await prisma.shipment.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            customerEmail: true,
            customerPhone: true,
            shippingAddress: true,
            totalAmount: true,
            status: true,
            items: true,
          },
        },
      },
    });

    if (!shipment) {
      return NextResponse.json({ error: 'Shipment not found' }, { status: 404 });
    }

    return NextResponse.json(shipment);
  } catch (error) {
    console.error('Error fetching shipment:', error);
    return NextResponse.json({ error: 'Failed to fetch shipment' }, { status: 500 });
  }
}

// PUT /api/shipments/[id] - Update shipment or trigger tracking sync
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Find shipment
    const existingShipment = await prisma.shipment.findUnique({
      where: { id },
    });

    if (!existingShipment) {
      return NextResponse.json({ error: 'Shipment not found' }, { status: 404 });
    }

    // If action is 'sync', fetch latest tracking from TracxLogis
    if (body.action === 'sync') {
      const result = await syncShipmentStatus(existingShipment.trackingNumber);
      
      if (result?.error) {
        return NextResponse.json(
          { error: result.error, message: 'Failed to sync tracking' },
          { status: 400 }
        );
      }

      // Fetch updated shipment
      const updatedShipment = await prisma.shipment.findUnique({
        where: { id },
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

      return NextResponse.json({
        shipment: updatedShipment,
        tracking: result,
        message: 'Tracking synced successfully',
      });
    }

    // Manual update
    const { status, statusMessage, estimatedDelivery, carrier } = body;

    const updatedShipment = await prisma.shipment.update({
      where: { id },
      data: {
        status: status || undefined,
        statusMessage: statusMessage !== undefined ? statusMessage : undefined,
        estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : undefined,
        carrier: carrier || undefined,
        // Update timestamps based on status
        ...(status === 'PICKED_UP' && !existingShipment.pickedUpAt ? { pickedUpAt: new Date() } : {}),
        ...(status === 'DELIVERED' && !existingShipment.deliveredAt ? { deliveredAt: new Date(), actualDelivery: new Date() } : {}),
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

    // Update order status based on shipment status
    if (status === 'DELIVERED') {
      await prisma.order.update({
        where: { id: existingShipment.orderId },
        data: { status: 'DELIVERED' },
      });
    }

    return NextResponse.json(updatedShipment);
  } catch (error) {
    console.error('Error updating shipment:', error);
    return NextResponse.json({ error: 'Failed to update shipment' }, { status: 500 });
  }
}

// DELETE /api/shipments/[id] - Delete shipment
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const shipment = await prisma.shipment.findUnique({
      where: { id },
    });

    if (!shipment) {
      return NextResponse.json({ error: 'Shipment not found' }, { status: 404 });
    }

    // Only allow deletion of PENDING shipments
    if (shipment.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Can only delete pending shipments' },
        { status: 400 }
      );
    }

    await prisma.shipment.delete({
      where: { id },
    });

    // Revert order status if needed
    await prisma.order.update({
      where: { id: shipment.orderId },
      data: { status: 'PROCESSING' },
    });

    return NextResponse.json({ message: 'Shipment deleted' });
  } catch (error) {
    console.error('Error deleting shipment:', error);
    return NextResponse.json({ error: 'Failed to delete shipment' }, { status: 500 });
  }
}
