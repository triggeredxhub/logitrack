import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import crypto from 'crypto';

const SHOPEE_API_BASE = process.env.SHOPEE_API_BASE || 'https://partner.test-stable.shopeemobile.com';

// POST /api/shopee/test - Test Shopee credentials
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { partnerId, partnerKey } = body;

    if (!partnerId || !partnerKey) {
      return NextResponse.json(
        { success: false, error: 'partnerId and partnerKey are required' },
        { status: 400 }
      );
    }

    // Use the shop/get_shop_list API to test credentials
    // This is a public API that only requires partner auth (no shop-level auth)
    const path = '/api/v2/public/get_shops_by_partner';
    const timestamp = Math.floor(Date.now() / 1000);
    const partnerIdNum = parseInt(partnerId, 10);
    
    if (isNaN(partnerIdNum)) {
      return NextResponse.json(
        { success: false, error: 'Partner ID must be a valid number' },
        { status: 400 }
      );
    }

    // Generate signature: partner_id + path + timestamp
    const baseString = `${partnerIdNum}${path}${timestamp}`;
    const sign = crypto
      .createHmac('sha256', partnerKey)
      .update(baseString)
      .digest('hex');

    const url = `${SHOPEE_API_BASE}${path}?partner_id=${partnerIdNum}&timestamp=${timestamp}&sign=${sign}`;

    console.log('Testing Shopee credentials with URL:', url);
    console.log('Base string for signature:', baseString);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page_no: 1,
        page_size: 1,
      }),
    });

    const data = await response.json();
    console.log('Shopee test response:', JSON.stringify(data));

    // Check for errors
    if (data.error) {
      let errorMessage = 'Invalid credentials';
      
      if (data.error === 'error_sign' || data.error === 'error_wrong_sign') {
        errorMessage = 'Invalid Partner Key. The signature verification failed.';
      } else if (data.error === 'error_param' || data.error === 'invalid_partner_id') {
        errorMessage = 'Invalid Partner ID. Please check your credentials.';
      } else if (data.error === 'error_auth') {
        errorMessage = 'Authentication failed. Please check your Partner ID and Partner Key.';
      } else if (data.message) {
        errorMessage = data.message;
      }

      return NextResponse.json(
        { success: false, error: errorMessage, details: data },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Credentials are valid',
    });
  } catch (error) {
    console.error('Error testing Shopee credentials:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to test credentials. Please try again.' },
      { status: 500 }
    );
  }
}
