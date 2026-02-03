import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { LowStockAlert } from '@/lib/types';

// GET /api/inventory/low-stock - List all products with low stock
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Get all active products with their batch totals
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
      },
      include: {
        batches: {
          where: {
            isExpired: false,
          },
          select: {
            quantity: true,
          },
        },
      },
    });

    // Calculate total stock for each product and filter low stock
    const lowStockProducts: LowStockAlert[] = products
      .map((product) => {
        const totalStock = product.batches.reduce((sum: number, batch: { quantity: number }) => sum + batch.quantity, 0);
        return {
          product: {
            ...product,
            sellingPrice: product.sellingPrice ? parseFloat(product.sellingPrice.toString()) : null,
          },
          totalStock,
          reorderLevel: product.reorderLevel,
          deficit: product.reorderLevel - totalStock,
        };
      })
      .filter((item: LowStockAlert) => item.totalStock < item.reorderLevel)
      .sort((a: LowStockAlert, b: LowStockAlert) => b.deficit - a.deficit); // Sort by deficit (most urgent first)

    // Paginate
    const total = lowStockProducts.length;
    const paginatedProducts = lowStockProducts.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      success: true,
      data: paginatedProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching low stock products:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch low stock products' },
      { status: 500 }
    );
  }
}
