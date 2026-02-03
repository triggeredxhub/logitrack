import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/inventory/expired - List all expired batches
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const now = new Date();

    // Find batches that are either marked as expired OR have expiry date in the past
    const where = {
      OR: [
        { isExpired: true },
        {
          AND: [
            { expiryDate: { not: null } },
            { expiryDate: { lt: now } },
          ],
        },
      ],
    };

    const [batches, total] = await Promise.all([
      prisma.inventoryBatch.findMany({
        where,
        include: {
          product: true,
        },
        orderBy: { expiryDate: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.inventoryBatch.count({ where }),
    ]);

    const expiredBatches = batches.map(batch => {
      let daysExpired: number | null = null;

      if (batch.expiryDate) {
        daysExpired = Math.ceil(
          (now.getTime() - batch.expiryDate.getTime()) / (1000 * 60 * 60 * 24)
        );
      }

      return {
        ...batch,
        costPrice: batch.costPrice ? parseFloat(batch.costPrice.toString()) : null,
        product: {
          ...batch.product,
          sellingPrice: batch.product.sellingPrice ? parseFloat(batch.product.sellingPrice.toString()) : null,
        },
        daysExpired,
        status: 'expired' as const,
      };
    });

    return NextResponse.json({
      success: true,
      data: expiredBatches,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching expired batches:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch expired batches' },
      { status: 500 }
    );
  }
}
