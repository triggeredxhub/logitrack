import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/shipments/config - Get TracxLogis configurations
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const configs = await prisma.tracxLogisConfig.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        apiEndpoint: true,
        isActive: true,
        lastSyncAt: true,
        createdAt: true,
        // Don't expose API key
      },
    });

    return NextResponse.json({ configs });
  } catch (error) {
    console.error('Error fetching TracxLogis configs:', error);
    return NextResponse.json({ error: 'Failed to fetch configurations' }, { status: 500 });
  }
}

// POST /api/shipments/config - Create TracxLogis configuration
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, apiKey, apiEndpoint, isActive } = body;

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }

    // If this is to be the active config, deactivate others
    if (isActive !== false) {
      await prisma.tracxLogisConfig.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
    }

    const config = await prisma.tracxLogisConfig.create({
      data: {
        name: name || 'Default',
        apiKey,
        apiEndpoint: apiEndpoint || 'https://api.tracxlogis.com',
        isActive: isActive !== false,
      },
      select: {
        id: true,
        name: true,
        apiEndpoint: true,
        isActive: true,
        lastSyncAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    console.error('Error creating TracxLogis config:', error);
    return NextResponse.json({ error: 'Failed to create configuration' }, { status: 500 });
  }
}

// DELETE /api/shipments/config - Delete TracxLogis configuration
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Configuration ID is required' }, { status: 400 });
    }

    await prisma.tracxLogisConfig.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Configuration deleted' });
  } catch (error) {
    console.error('Error deleting TracxLogis config:', error);
    return NextResponse.json({ error: 'Failed to delete configuration' }, { status: 500 });
  }
}
