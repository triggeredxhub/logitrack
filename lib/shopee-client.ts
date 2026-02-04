import crypto from "crypto";
import { prisma } from "./db";

// Sandbox: https://partner.test-stable.shopeemobile.com
// Production: https://partner.shopeemobile.com
const SHOPEE_API_BASE =
  process.env.SHOPEE_API_BASE || "https://partner.test-stable.shopeemobile.com";

const SHOPEE_AUTH_BASE =
  process.env.SHOPEE_AUTH_BASE || "https://open.sandbox.test-stable.shopee.com";

// Shopee API response types
interface ShopeeApiResponse<T> {
  error: string;
  message: string;
  request_id: string;
  response?: T;
}

interface ShopeeTokenResponse {
  access_token: string;
  refresh_token: string;
  expire_in: number; // seconds (typically 14400 = 4 hours)
  shop_id?: number;
  merchant_id?: number;
}

interface ShopeeOrderListResponse {
  order_list: Array<{
    order_sn: string;
  }>;
  more: boolean;
  next_cursor?: string;
}

interface ShopeeOrderDetailResponse {
  order_list: ShopeeOrder[];
}

export interface ShopeeOrder {
  order_sn: string;
  order_status: string;
  create_time: number;
  update_time: number;
  buyer_user_id: number;
  buyer_username: string;
  recipient_address: {
    name: string;
    phone: string;
    town: string;
    district: string;
    city: string;
    state: string;
    region: string;
    zipcode: string;
    full_address: string;
  };
  total_amount: number;
  currency: string;
  item_list: ShopeeOrderItem[];
  shipping_carrier?: string;
  tracking_no?: string;
  estimated_shipping_fee?: number;
}

export interface ShopeeOrderItem {
  item_id: number;
  item_name: string;
  item_sku: string;
  model_id?: number;
  model_name?: string;
  model_sku?: string;
  model_quantity_purchased: number;
  model_original_price: number;
  model_discounted_price: number;
}

class ShopeeClient {
  private partnerId: string;
  private partnerKey: string;
  private shopId: string;
  private accessToken: string | null = null;
  private configId: string;

  constructor(
    partnerId: string,
    partnerKey: string,
    shopId: string,
    accessToken: string | null,
    configId: string,
  ) {
    this.partnerId = partnerId;
    this.partnerKey = partnerKey;
    this.shopId = shopId;
    this.accessToken = accessToken;
    this.configId = configId;
  }

  /**
   * Generate HMAC-SHA256 signature for Shopee API requests
   */
  private generateSignature(
    path: string,
    timestamp: number,
    accessToken?: string,
    shopId?: string,
  ): string {
    const partnerIdNum = parseInt(this.partnerId, 10);
    let baseString = `${partnerIdNum}${path}${timestamp}`;
    if (accessToken) {
      baseString += accessToken;
    }
    if (shopId) {
      baseString += parseInt(shopId, 10);
    }
    return crypto
      .createHmac("sha256", this.partnerKey)
      .update(baseString)
      .digest("hex");
  }

  /**
   * Make authenticated API request to Shopee
   */
  private async request<T>(
    path: string,
    method: "GET" | "POST" = "GET",
    body?: Record<string, unknown>,
    useShopAuth = true,
  ): Promise<ShopeeApiResponse<T>> {
    const timestamp = Math.floor(Date.now() / 1000);
    const partnerIdNum = parseInt(this.partnerId, 10);
    const sign = this.generateSignature(
      path,
      timestamp,
      useShopAuth ? this.accessToken || undefined : undefined,
      useShopAuth ? this.shopId : undefined,
    );

    let url = `${SHOPEE_API_BASE}${path}?partner_id=${partnerIdNum}&timestamp=${timestamp}&sign=${sign}`;

    if (useShopAuth) {
      url += `&shop_id=${parseInt(this.shopId, 10)}`;
      if (this.accessToken) {
        url += `&access_token=${this.accessToken}`;
      }
    }

    const options: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (body && method === "POST") {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    return response.json();
  }

  /**
   * Get OAuth authorization URL
   */
  // static getAuthUrl(
  //   partnerId: string,
  //   partnerKey: string,
  //   redirectUrl: string,
  //   shopId: string,
  // ): string {
  //   const path = "/api/v2/shop/auth_partner";
  //   const timestamp = Math.floor(Date.now() / 1000);
  //   const partnerIdNum = parseInt(partnerId, 10);
  //   const baseString = `${partnerIdNum}${path}${timestamp}`;
  //   const sign = crypto
  //     .createHmac("sha256", partnerKey)
  //     .update(baseString)
  //     .digest("hex");

  //   // Build URL manually to avoid URLSearchParams encoding issues
  //   return (
  //     `${SHOPEE_API_BASE}${path}` +
  //     `?partner_id=${partnerIdNum}` +
  //     `&timestamp=${timestamp}` +
  //     `&sign=${sign}` +
  //     `&redirect=${encodeURIComponent(redirectUrl)}` +
  //     `&shop_id=${shopId}`
  //   );
  // }
  static getAuthUrl(
    partnerId: string,
    partnerKey: string,
    redirectUrl: string,
    shopId: string,
  ): string {
    // IMPORTANT: signature path ≠ browser path
    const signPath = "/api/v2/shop/auth_partner";
    const authPath = "/auth";

    const timestamp = Math.floor(Date.now() / 1000);
    const partnerIdNum = Number(partnerId);

    const baseString = `${partnerIdNum}${signPath}${timestamp}`;
    const sign = crypto
      .createHmac("sha256", partnerKey)
      .update(baseString)
      .digest("hex");

    const AUTH_BASE =
      process.env.SHOPEE_AUTH_BASE ||
      "https://open.sandbox.test-stable.shopee.com";

    return (
      `${AUTH_BASE}${authPath}` +
      `?partner_id=${partnerIdNum}` +
      `&timestamp=${timestamp}` +
      `&sign=${sign}` +
      `&redirect_uri=${encodeURIComponent(redirectUrl)}` +
      `&shop_id=${shopId}` +
      `&auth_type=seller` +
      `&response_type=code`
    );
  }

  /**
   * Exchange authorization code for access token
   */
  static async getAccessToken(
    partnerId: string,
    partnerKey: string,
    code: string,
    shopId: string,
  ): Promise<ShopeeApiResponse<ShopeeTokenResponse>> {
    const path = "/api/v2/auth/token/get";
    const timestamp = Math.floor(Date.now() / 1000);
    const partnerIdNum = parseInt(partnerId, 10);
    const baseString = `${partnerIdNum}${path}${timestamp}`;
    const sign = crypto
      .createHmac("sha256", partnerKey)
      .update(baseString)
      .digest("hex");

    const url = `${SHOPEE_API_BASE}${path}?partner_id=${partnerIdNum}&timestamp=${timestamp}&sign=${sign}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        shop_id: parseInt(shopId, 10),
        partner_id: partnerIdNum,
      }),
    });

    return response.json();
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<boolean> {
    const path = "/api/v2/auth/access_token/get";
    const timestamp = Math.floor(Date.now() / 1000);
    const partnerIdNum = parseInt(this.partnerId, 10);
    const baseString = `${partnerIdNum}${path}${timestamp}`;
    const sign = crypto
      .createHmac("sha256", this.partnerKey)
      .update(baseString)
      .digest("hex");

    const url = `${SHOPEE_API_BASE}${path}?partner_id=${partnerIdNum}&timestamp=${timestamp}&sign=${sign}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refresh_token: refreshToken,
        shop_id: parseInt(this.shopId, 10),
        partner_id: partnerIdNum,
      }),
    });

    const data: ShopeeApiResponse<ShopeeTokenResponse> = await response.json();

    if (data.error || !data.response) {
      console.error("Token refresh failed:", data.message || data.error);
      return false;
    }

    // Update tokens in database
    const expiresAt = new Date(Date.now() + data.response.expire_in * 1000);
    await prisma.shopeeConfig.update({
      where: { id: this.configId },
      data: {
        accessToken: data.response.access_token,
        refreshToken: data.response.refresh_token,
        tokenExpiresAt: expiresAt,
      },
    });

    this.accessToken = data.response.access_token;
    return true;
  }

  /**
   * Ensure we have a valid access token, refresh if needed
   */
  async ensureValidToken(): Promise<boolean> {
    const config = await prisma.shopeeConfig.findUnique({
      where: { id: this.configId },
    });

    if (!config || !config.accessToken || !config.refreshToken) {
      return false;
    }

    // Check if token is expired or expiring soon (within 30 minutes)
    const tokenExpiresAt = config.tokenExpiresAt;
    const bufferTime = 30 * 60 * 1000; // 30 minutes

    if (!tokenExpiresAt || tokenExpiresAt.getTime() < Date.now() + bufferTime) {
      console.log("Token expired or expiring soon, refreshing...");
      return this.refreshAccessToken(config.refreshToken);
    }

    this.accessToken = config.accessToken;
    return true;
  }

  /**
   * Get list of orders from Shopee
   */
  async getOrderList(
    timeRangeField: "create_time" | "update_time" = "create_time",
    timeFrom: number,
    timeTo: number,
    pageSize = 50,
    cursor?: string,
  ): Promise<ShopeeApiResponse<ShopeeOrderListResponse>> {
    if (!(await this.ensureValidToken())) {
      return {
        error: "error_auth",
        message: "Failed to authenticate with Shopee",
        request_id: "",
      };
    }

    const body: Record<string, unknown> = {
      time_range_field: timeRangeField,
      time_from: timeFrom,
      time_to: timeTo,
      page_size: pageSize,
      order_status: "ALL",
      response_optional_fields: "order_status",
    };

    if (cursor) {
      body.cursor = cursor;
    }

    return this.request<ShopeeOrderListResponse>(
      "/api/v2/order/get_order_list",
      "POST",
      body,
    );
  }

  /**
   * Get order details for specific order SNs
   */
  async getOrderDetails(
    orderSnList: string[],
  ): Promise<ShopeeApiResponse<ShopeeOrderDetailResponse>> {
    if (!(await this.ensureValidToken())) {
      return {
        error: "error_auth",
        message: "Failed to authenticate with Shopee",
        request_id: "",
      };
    }

    const body = {
      order_sn_list: orderSnList,
      response_optional_fields: [
        "buyer_user_id",
        "buyer_username",
        "recipient_address",
        "total_amount",
        "currency",
        "item_list",
        "shipping_carrier",
        "tracking_no",
      ].join(","),
    };

    return this.request<ShopeeOrderDetailResponse>(
      "/api/v2/order/get_order_detail",
      "POST",
      body,
    );
  }

  /**
   * Get shop info
   */
  async getShopInfo(): Promise<
    ShopeeApiResponse<{ shop_name: string; status: string }>
  > {
    if (!(await this.ensureValidToken())) {
      return {
        error: "error_auth",
        message: "Failed to authenticate with Shopee",
        request_id: "",
      };
    }

    return this.request<{ shop_name: string; status: string }>(
      "/api/v2/shop/get_shop_info",
      "GET",
    );
  }
}

/**
 * Create a ShopeeClient instance from database config
 */
export async function createShopeeClient(
  configId?: string,
): Promise<ShopeeClient | null> {
  let config;

  if (configId) {
    config = await prisma.shopeeConfig.findUnique({
      where: { id: configId },
    });
  } else {
    // Get the first active config
    config = await prisma.shopeeConfig.findFirst({
      where: { isActive: true },
    });
  }

  if (!config) {
    return null;
  }

  return new ShopeeClient(
    config.partnerId,
    config.partnerKey,
    config.shopId,
    config.accessToken,
    config.id,
  );
}

/**
 * Map Shopee order status to internal order status
 */
export function mapShopeeStatus(
  shopeeStatus: string,
):
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED" {
  const statusMap: Record<
    string,
    | "PENDING"
    | "CONFIRMED"
    | "PROCESSING"
    | "SHIPPED"
    | "DELIVERED"
    | "CANCELLED"
    | "REFUNDED"
  > = {
    UNPAID: "PENDING",
    READY_TO_SHIP: "CONFIRMED",
    PROCESSED: "PROCESSING",
    SHIPPED: "SHIPPED",
    COMPLETED: "DELIVERED",
    CANCELLED: "CANCELLED",
    IN_CANCEL: "CANCELLED",
    TO_RETURN: "REFUNDED",
  };

  return statusMap[shopeeStatus] || "PENDING";
}

export { ShopeeClient };
