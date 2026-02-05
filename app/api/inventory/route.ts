
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { CreateInventoryBatchInput } from '@/lib/types';

// GET /api/inventory - List all inventory batches
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const productId = searchParams.get('productId') || '';
    const search = searchParams.get('search') || '';
    const location = searchParams.get('location') || '';
    const expiredOnly = searchParams.get('expiredOnly') === 'true';
    const expiringSoon = searchParams.get('expiringSoon') === 'true';

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const where: Record<string, unknown> = {};

    if (productId) {
      where.productId = productId;
    }

    if (search) {
      where.OR = [
        { batchNumber: { contains: search, mode: 'insensitive' } },
        { product: { name: { contains: search, mode: 'insensitive' } } },
        { product: { sku: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (location) {
      where.location = { contains: location, mode: 'insensitive' };
    }

    if (expiredOnly) {
      where.OR = [
        { isExpired: true },
        { expiryDate: { lt: now } },
      ];
    } else if (expiringSoon) {
      where.AND = [
        { isExpired: false },
        { expiryDate: { not: null } },
        { expiryDate: { gt: now } },
        { expiryDate: { lte: thirtyDaysFromNow } },
      ];
    }

    const [batches, total] = await Promise.all([
      prisma.inventoryBatch.findMany({
        where,
        include: {
          product: true,
        },
        orderBy: [{ expiryDate: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.inventoryBatch.count({ where }),
    ]);

    const batchesWithDetails = batches.map((batch) => {
      let daysUntilExpiry: number | null = null;
      let isExpiringSoon = false;

      if (batch.expiryDate) {
        daysUntilExpiry = Math.ceil(
          (batch.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        isExpiringSoon = daysUntilExpiry > 0 && daysUntilExpiry <= 30;
      }

      return {
        ...batch,
        costPrice: batch.costPrice ? parseFloat(batch.costPrice.toString()) : null,
        product: {
          ...batch.product,
          sellingPrice: batch.product.sellingPrice ? parseFloat(batch.product.sellingPrice.toString()) : null,
        },
        daysUntilExpiry,
        isExpiringSoon,
      };
    });

    return NextResponse.json({
      success: true,
      data: batchesWithDetails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching inventory batches:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch inventory batches' },
      { status: 500 }
    );
  }
}

// POST /api/inventory - Create a new inventory batch
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateInventoryBatchInput = await request.json();

    // Validate required fields
    if (!body.productId || !body.batchNumber || body.quantity === undefined) {
      return NextResponse.json(
        { success: false, error: 'Product ID, batch number, and quantity are required' },
        { status: 400 }
      );
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: body.productId },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    // Check if batch number already exists for this product
    const existingBatch = await prisma.inventoryBatch.findUnique({
      where: {
        productId_batchNumber: {
          productId: body.productId,
          batchNumber: body.batchNumber,
        },
      },
    });

    if (existingBatch) {
      return NextResponse.json(
        { success: false, error: 'A batch with this number already exists for this product' },
        { status: 400 }
      );
    }

    // Check if expiry date is in the past
    let isExpired = false;
    let expiryDate: Date | null = null;

    if (body.expiryDate) {
      expiryDate = new Date(body.expiryDate);
      isExpired = expiryDate < new Date();
    }

    const batch = await prisma.inventoryBatch.create({
      data: {
        productId: body.productId,
        batchNumber: body.batchNumber,
        quantity: body.quantity,
        expiryDate,
        isExpired,
        location: body.location || null,
        costPrice: body.costPrice || null,
        notes: body.notes || null,
      },
      include: {
        product: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          ...batch,
          costPrice: batch.costPrice ? parseFloat(batch.costPrice.toString()) : null,
          product: {
            ...batch.product,
            sellingPrice: batch.product.sellingPrice ? parseFloat(batch.product.sellingPrice.toString()) : null,
          },
        },
        message: 'Inventory batch created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating inventory batch:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create inventory batch' },
      { status: 500 }
    );
  }
}
