import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// POST /api/cron/flag-expired - Auto-flag expired batches
// This endpoint can be called by a cron job or scheduled task
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for security (optional but recommended)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // If CRON_SECRET is set, verify it
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const now = new Date();

    // Find all batches that have expired but not yet flagged
    const expiredBatches = await prisma.inventoryBatch.findMany({
      where: {
        AND: [
          { isExpired: false },
          { expiryDate: { not: null } },
          { expiryDate: { lt: now } },
        ],
      },
      select: {
        id: true,
        batchNumber: true,
        expiryDate: true,
        product: {
          select: {
            name: true,
            sku: true,
          },
        },
      },
    });

    if (expiredBatches.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expired batches to flag',
        data: {
          flaggedCount: 0,
          flaggedBatches: [],
        },
      });
    }

    // Update all expired batches
    const batchIds = expiredBatches.map(b => b.id);

    await prisma.inventoryBatch.updateMany({
      where: {
        id: { in: batchIds },
      },
      data: {
        isExpired: true,
      },
    });

    // Log the flagged batches for audit
    const flaggedDetails = expiredBatches.map(batch => ({
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      productName: batch.product.name,
      productSku: batch.product.sku,
      expiryDate: batch.expiryDate,
    }));

    console.log(`[CRON] Flagged ${expiredBatches.length} expired batches:`, flaggedDetails);

    return NextResponse.json({
      success: true,
      message: `Successfully flagged ${expiredBatches.length} expired batch(es)`,
      data: {
        flaggedCount: expiredBatches.length,
        flaggedBatches: flaggedDetails,
      },
    });
  } catch (error) {
    console.error('Error flagging expired batches:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to flag expired batches' },
      { status: 500 }
    );
  }
}

// GET endpoint for manual check (for debugging/testing)
export async function GET() {
  try {
    const now = new Date();

    // Count batches that would be flagged
    const pendingFlagCount = await prisma.inventoryBatch.count({
      where: {
        AND: [
          { isExpired: false },
          { expiryDate: { not: null } },
          { expiryDate: { lt: now } },
        ],
      },
    });

    const alreadyFlaggedCount = await prisma.inventoryBatch.count({
      where: {
        isExpired: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        pendingFlagCount,
        alreadyFlaggedCount,
        message: pendingFlagCount > 0
          ? `${pendingFlagCount} batch(es) pending to be flagged as expired`
          : 'No batches pending to be flagged',
      },
    });
  } catch (error) {
    console.error('Error checking expired batches:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check expired batches' },
      { status: 500 }
    );
  }
}
