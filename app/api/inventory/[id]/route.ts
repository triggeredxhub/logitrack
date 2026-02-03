import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { UpdateInventoryBatchInput } from '@/lib/types';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/inventory/[id] - Get a single inventory batch
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

    const batch = await prisma.inventoryBatch.findUnique({
      where: { id },
      include: {
        product: true,
      },
    });

    if (!batch) {
      return NextResponse.json(
        { success: false, error: 'Inventory batch not found' },
        { status: 404 }
      );
    }

    const now = new Date();
    let daysUntilExpiry: number | null = null;
    let isExpiringSoon = false;

    if (batch.expiryDate) {
      daysUntilExpiry = Math.ceil(
        (batch.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      isExpiringSoon = daysUntilExpiry > 0 && daysUntilExpiry <= 30;
    }

    return NextResponse.json({
      success: true,
      data: {
        ...batch,
        costPrice: batch.costPrice ? parseFloat(batch.costPrice.toString()) : null,
        product: {
          ...batch.product,
          sellingPrice: batch.product.sellingPrice ? parseFloat(batch.product.sellingPrice.toString()) : null,
        },
        daysUntilExpiry,
        isExpiringSoon,
      },
    });
  } catch (error) {
    console.error('Error fetching inventory batch:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch inventory batch' },
      { status: 500 }
    );
  }
}

// PUT /api/inventory/[id] - Update an inventory batch
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
    const body: UpdateInventoryBatchInput = await request.json();

    // Check if batch exists
    const existingBatch = await prisma.inventoryBatch.findUnique({
      where: { id },
    });

    if (!existingBatch) {
      return NextResponse.json(
        { success: false, error: 'Inventory batch not found' },
        { status: 404 }
      );
    }

    // Check if batch number is being changed and if it's already taken
    if (body.batchNumber && body.batchNumber !== existingBatch.batchNumber) {
      const batchExists = await prisma.inventoryBatch.findUnique({
        where: {
          productId_batchNumber: {
            productId: existingBatch.productId,
            batchNumber: body.batchNumber,
          },
        },
      });

      if (batchExists) {
        return NextResponse.json(
          { success: false, error: 'A batch with this number already exists for this product' },
          { status: 400 }
        );
      }
    }

    // Handle expiry date update
    let isExpired = existingBatch.isExpired;
    let expiryDate: Date | null | undefined = undefined;

    if (body.expiryDate !== undefined) {
      if (body.expiryDate === null || body.expiryDate === '') {
        expiryDate = null;
        isExpired = false;
      } else {
        expiryDate = new Date(body.expiryDate);
        isExpired = expiryDate < new Date();
      }
    }

    const batch = await prisma.inventoryBatch.update({
      where: { id },
      data: {
        ...(body.batchNumber && { batchNumber: body.batchNumber }),
        ...(body.quantity !== undefined && { quantity: body.quantity }),
        ...(expiryDate !== undefined && { expiryDate }),
        ...(isExpired !== existingBatch.isExpired && { isExpired }),
        ...(body.location !== undefined && { location: body.location || null }),
        ...(body.costPrice !== undefined && { costPrice: body.costPrice || null }),
        ...(body.notes !== undefined && { notes: body.notes || null }),
      },
      include: {
        product: true,
      },
    });

    const now = new Date();
    let daysUntilExpiry: number | null = null;
    let isExpiringSoon = false;

    if (batch.expiryDate) {
      daysUntilExpiry = Math.ceil(
        (batch.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      isExpiringSoon = daysUntilExpiry > 0 && daysUntilExpiry <= 30;
    }

    return NextResponse.json({
      success: true,
      data: {
        ...batch,
        costPrice: batch.costPrice ? parseFloat(batch.costPrice.toString()) : null,
        product: {
          ...batch.product,
          sellingPrice: batch.product.sellingPrice ? parseFloat(batch.product.sellingPrice.toString()) : null,
        },
        daysUntilExpiry,
        isExpiringSoon,
      },
      message: 'Inventory batch updated successfully',
    });
  } catch (error) {
    console.error('Error updating inventory batch:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update inventory batch' },
      { status: 500 }
    );
  }
}

// DELETE /api/inventory/[id] - Delete an inventory batch
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

    // Check if batch exists
    const existingBatch = await prisma.inventoryBatch.findUnique({
      where: { id },
    });

    if (!existingBatch) {
      return NextResponse.json(
        { success: false, error: 'Inventory batch not found' },
        { status: 404 }
      );
    }

    await prisma.inventoryBatch.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Inventory batch deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting inventory batch:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete inventory batch' },
      { status: 500 }
    );
  }
}
