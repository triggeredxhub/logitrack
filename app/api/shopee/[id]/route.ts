import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ShopeeClient } from "@/lib/shopee-client";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/shopee/[id] - Get Shopee config details
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { id } = await context.params;

    const config = await prisma.shopeeConfig.findUnique({
      where: { id },
      include: {
        syncLogs: {
          orderBy: { startedAt: "desc" },
          take: 10,
        },
      },
    });

    if (!config) {
      return NextResponse.json(
        { success: false, error: "Configuration not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: config.id,
        shopId: config.shopId,
        shopName: config.shopName,
        partnerId: config.partnerId,
        isActive: config.isActive,
        isTokenValid: config.tokenExpiresAt
          ? config.tokenExpiresAt > new Date()
          : false,
        tokenExpiresAt: config.tokenExpiresAt,
        lastSyncAt: config.lastSyncAt,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
        syncLogs: config.syncLogs,
      },
    });
  } catch (error) {
    console.error("Error fetching Shopee config:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch configuration" },
      { status: 500 },
    );
  }
}

// PUT /api/shopee/[id] - Update Shopee config
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { id } = await context.params;
    const body = await request.json();
    const { shopName, isActive, partnerKey } = body;

    const config = await prisma.shopeeConfig.findUnique({
      where: { id },
    });

    if (!config) {
      return NextResponse.json(
        { success: false, error: "Configuration not found" },
        { status: 404 },
      );
    }

    const updated = await prisma.shopeeConfig.update({
      where: { id },
      data: {
        ...(shopName !== undefined && { shopName }),
        ...(isActive !== undefined && { isActive }),
        ...(partnerKey !== undefined && { partnerKey }),
      },
      select: {
        id: true,
        shopId: true,
        shopName: true,
        partnerId: true,
        isActive: true,
        lastSyncAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Configuration updated",
    });
  } catch (error) {
    console.error("Error updating Shopee config:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update configuration" },
      { status: 500 },
    );
  }
}

// DELETE /api/shopee/[id] - Delete Shopee config
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { id } = await context.params;

    const config = await prisma.shopeeConfig.findUnique({
      where: { id },
    });

    if (!config) {
      return NextResponse.json(
        { success: false, error: "Configuration not found" },
        { status: 404 },
      );
    }

    await prisma.shopeeConfig.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Configuration deleted",
    });
  } catch (error) {
    console.error("Error deleting Shopee config:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete configuration" },
      { status: 500 },
    );
  }
}

// POST /api/shopee/[id] - Get auth URL for re-authorization
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { id } = await context.params;

    const config = await prisma.shopeeConfig.findUnique({
      where: { id },
    });

    if (!config) {
      return NextResponse.json(
        { success: false, error: "Configuration not found" },
        { status: 404 },
      );
    }

    // Generate OAuth URL
    const redirectUrl = `${process.env.NEXTAUTH_URL}/api/shopee/callback`;
    const authUrl = ShopeeClient.getAuthUrl(
      config.partnerId,
      config.partnerKey,
      redirectUrl,
      config.shopId,
    );

    return NextResponse.json({
      success: true,
      authUrl,
      message: "Please authorize with Shopee",
    });
  } catch (error) {
    console.error("Error generating auth URL:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate authorization URL" },
      { status: 500 },
    );
  }
}
