import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { syncShopeeOrders, getSyncHistory } from '@/lib/shopee-sync';

// POST /api/shopee/sync - Trigger order sync
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { configId, daysBack = 7 } = body;

    if (!configId) {
      return NextResponse.json(
        { success: false, error: 'configId is required' },
        { status: 400 }
      );
    }

    // Validate config exists and has tokens
    const config = await prisma.shopeeConfig.findUnique({
      where: { id: configId },
    });

    if (!config) {
      return NextResponse.json(
        { success: false, error: 'Configuration not found' },
        { status: 404 }
      );
    }

    if (!config.accessToken || !config.refreshToken) {
      return NextResponse.json(
        { success: false, error: 'Shop not authorized. Please authorize with Shopee first.' },
        { status: 400 }
      );
    }

    // Run sync
    const result = await syncShopeeOrders(configId, daysBack);

    return NextResponse.json({
      success: result.success,
      data: result,
      message: result.success
        ? `Sync completed. Imported ${result.ordersImported} orders, skipped ${result.ordersSkipped}.`
        : 'Sync failed',
    });
  } catch (error) {
    console.error('Error triggering sync:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to trigger sync' },
      { status: 500 }
    );
  }
}

// GET /api/shopee/sync - Get sync history
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const configId = searchParams.get('configId');

    if (!configId) {
      return NextResponse.json(
        { success: false, error: 'configId is required' },
        { status: 400 }
      );
    }

    const history = await getSyncHistory(configId);

    return NextResponse.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('Error fetching sync history:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sync history' },
      { status: 500 }
    );
  }
}
