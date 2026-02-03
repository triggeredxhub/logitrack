import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ShopeeClient } from '@/lib/shopee-client';

// GET /api/shopee - List all Shopee configurations
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const configs = await prisma.shopeeConfig.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        shopId: true,
        shopName: true,
        partnerId: true,
        isActive: true,
        lastSyncAt: true,
        tokenExpiresAt: true,
        createdAt: true,
        updatedAt: true,
        // Don't expose tokens or keys
      },
    });

    return NextResponse.json({
      success: true,
      data: configs.map((config) => ({
        ...config,
        isTokenValid: config.tokenExpiresAt ? config.tokenExpiresAt > new Date() : false,
      })),
    });
  } catch (error) {
    console.error('Error fetching Shopee configs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch Shopee configurations' },
      { status: 500 }
    );
  }
}

// POST /api/shopee - Create new Shopee configuration
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { shopId, partnerId, partnerKey, shopName } = body;

    if (!shopId || !partnerId || !partnerKey) {
      return NextResponse.json(
        { success: false, error: 'shopId, partnerId, and partnerKey are required' },
        { status: 400 }
      );
    }

    // Check if shopId already exists
    const existing = await prisma.shopeeConfig.findUnique({
      where: { shopId: shopId.toString() },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'A configuration for this shop already exists' },
        { status: 400 }
      );
    }

    // Create config
    const config = await prisma.shopeeConfig.create({
      data: {
        shopId: shopId.toString(),
        shopName: shopName || null,
        partnerId: partnerId.toString(),
        partnerKey,
        isActive: true,
      },
      select: {
        id: true,
        shopId: true,
        shopName: true,
        partnerId: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Generate OAuth URL for authorization
    const redirectUrl = `${process.env.NEXTAUTH_URL}/api/shopee/callback`;
    const authUrl = ShopeeClient.getAuthUrl(partnerId.toString(), partnerKey, redirectUrl);

    return NextResponse.json(
      {
        success: true,
        data: config,
        authUrl,
        message: 'Configuration created. Please authorize with Shopee.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating Shopee config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create Shopee configuration' },
      { status: 500 }
    );
  }
}
