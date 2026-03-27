import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { CreateProductInput, ProductWithStock } from '@/lib/types';
import { createTracxClient } from "@/lib/tracx-client"; // adjust path if needed

// GET /api/products - List all products with stock info
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const activeOnly = searchParams.get('activeOnly') === 'true';
    

    const where: Record<string, unknown> = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    if (category) {
      where.category = category;
    }
    
    if (activeOnly) {
      where.isActive = true;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          batches: {
            select: {
              id: true,
              quantity: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    const productsWithStock: ProductWithStock[] = products.map((product) => {
      const totalStock = product.batches.reduce((sum: number, batch: { quantity: number }) => sum + batch.quantity, 0);
      return {
        ...product,
        sellingPrice: product.sellingPrice ? parseFloat(product.sellingPrice.toString()) : null,
        totalStock,
        isLowStock: totalStock < product.reorderLevel,
        batchCount: product.batches.length,
      };
    });

    return NextResponse.json({
      success: true,
      data: productsWithStock,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

// POST /api/products - Create a new product

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateProductInput = await request.json();

    if (!body.name || !body.sku) {
      return NextResponse.json(
        { success: false, error: 'Name and SKU are required' },
        { status: 400 }
      );
    }

    const existingProduct = await prisma.product.findUnique({
      where: { sku: body.sku },
    });

    if (existingProduct) {
      return NextResponse.json(
        { success: false, error: 'A product with this SKU already exists' },
        { status: 400 }
      );
    }

    // ✅ 1. Create product locally
    const product = await prisma.product.create({
      data: {
        name: body.name,
        sku: body.sku,
        description: body.description || null,
        category: body.category || null,
        reorderLevel: body.reorderLevel || 10,
        sellingPrice: body.sellingPrice || null,
      },
    });

    // ✅ 2. Call TracX CreateInventory
    const tracxClient = await createTracxClient();

    let tracxSkuNo: string | null = null;

    if (tracxClient) {
      try {
        const result = await tracxClient.createInventory({
          name: product.name,
          sku: product.sku,
          price: product.sellingPrice ? Number(product.sellingPrice) : 0,
        });

        tracxSkuNo = result.sku_no;

        // ✅ 3. Save SKU to DB
        await prisma.product.update({
          where: { id: product.id },
          data: {
            tracxSkuNo: tracxSkuNo,
          },
        });

      } catch (tracxError) {
        console.error("TracX CreateInventory failed:", tracxError);
        // ⚠️ do NOT fail the whole request
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          ...product,
          tracxSkuNo,
          sellingPrice: product.sellingPrice
            ? parseFloat(product.sellingPrice.toString())
            : null,
        },
        message: 'Product created successfully',
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create product' },
      { status: 500 }
    );
  }
}
