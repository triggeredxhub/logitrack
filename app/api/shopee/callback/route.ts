import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ShopeeClient } from '@/lib/shopee-client';

// GET /api/shopee/callback - Handle Shopee OAuth callback
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const shopId = searchParams.get('shop_id');

    if (!code || !shopId) {
      return NextResponse.redirect(
        new URL('/dashboard/data-sync?error=missing_params', process.env.NEXTAUTH_URL || '')
      );
    }

    // Find the config for this shop
    const config = await prisma.shopeeConfig.findUnique({
      where: { shopId: shopId.toString() },
    });

    if (!config) {
      return NextResponse.redirect(
        new URL('/dashboard/data-sync?error=config_not_found', process.env.NEXTAUTH_URL || '')
      );
    }

    // Exchange code for tokens
    const tokenResponse = await ShopeeClient.getAccessToken(
      config.partnerId,
      config.partnerKey,
      code,
      shopId
    );

    if (tokenResponse.error || !tokenResponse.response) {
      console.error('Token exchange failed:', tokenResponse.message || tokenResponse.error);
      return NextResponse.redirect(
        new URL(`/dashboard/data-sync?error=token_exchange_failed&message=${encodeURIComponent(tokenResponse.message || 'Unknown error')}`, process.env.NEXTAUTH_URL || '')
      );
    }

    // Calculate token expiration
    const expiresAt = new Date(Date.now() + tokenResponse.response.expire_in * 1000);

    // Update config with tokens
    await prisma.shopeeConfig.update({
      where: { id: config.id },
      data: {
        accessToken: tokenResponse.response.access_token,
        refreshToken: tokenResponse.response.refresh_token,
        tokenExpiresAt: expiresAt,
      },
    });

    // Redirect back to data sync page with success
    return NextResponse.redirect(
      new URL('/dashboard/data-sync?success=authorized', process.env.NEXTAUTH_URL || '')
    );
  } catch (error) {
    console.error('Error handling Shopee callback:', error);
    return NextResponse.redirect(
      new URL('/dashboard/data-sync?error=callback_failed', process.env.NEXTAUTH_URL || '')
    );
  }
}
