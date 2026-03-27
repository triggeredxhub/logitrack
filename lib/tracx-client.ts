/**
 * TracxLogis API Client
 * Documentation: https://api.tracxlogis.com/GMKT.INC.GLPS.OpenApiService/Document/QAPIGuideIndex.aspx
 */

import { prisma } from "./db";
import { ShipmentStatus } from "@prisma/client";

export interface TracxLogisConfig {
  apiKey: string;
  apiEndpoint: string;
}

export interface TrackingEvent {
  timestamp: string;
  status: string;
  statusCode: string;
  location: string;
  description: string;
}

export interface TrackingResult {
  trackingNumber: string;
  status: string;
  statusCode: string;
  carrier: string;
  estimatedDelivery?: string;
  actualDelivery?: string;
  events: TrackingEvent[];
  recipientName?: string;
  recipientAddress?: string;
  weight?: number;
  error?: string;
}

// Map TracxLogis status codes to our internal ShipmentStatus
export function mapTracxStatus(tracxStatus: string): ShipmentStatus {
  const statusMap: Record<string, ShipmentStatus> = {
    // Pickup/Collection
    PICKED_UP: "PICKED_UP",
    COLLECTED: "PICKED_UP",
    PICKUP_COMPLETE: "PICKED_UP",

    // In Transit
    IN_TRANSIT: "IN_TRANSIT",
    IN_PROGRESS: "IN_TRANSIT",
    DEPARTED: "IN_TRANSIT",
    ARRIVED: "IN_TRANSIT",
    PROCESSING: "IN_TRANSIT",
    CUSTOMS: "IN_TRANSIT",
    CUSTOMS_CLEARED: "IN_TRANSIT",

    // Out for Delivery
    OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
    WITH_COURIER: "OUT_FOR_DELIVERY",
    DELIVERING: "OUT_FOR_DELIVERY",

    // Delivered
    DELIVERED: "DELIVERED",
    COMPLETED: "DELIVERED",
    SIGNED: "DELIVERED",

    // Failed/Issues
    FAILED: "FAILED",
    DELIVERY_FAILED: "FAILED",
    EXCEPTION: "FAILED",
    HELD: "FAILED",
    REFUSED: "FAILED",

    // Returned
    RETURNED: "RETURNED",
    RETURN_TO_SENDER: "RETURNED",
    RTS: "RETURNED",

    // Pending
    PENDING: "PENDING",
    CREATED: "PENDING",
    LABEL_CREATED: "PENDING",
    AWAITING_PICKUP: "PENDING",
  };

  return statusMap[tracxStatus.toUpperCase()] || "IN_TRANSIT";
}

export class TracxLogisClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: TracxLogisConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.apiEndpoint || "https://api.tracxlogis.com";
  }

  /**
   * Generate API request headers
   */
  private getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      "X-API-Key": this.apiKey,
    };
  }

  /**
   * Track a single shipment
   */
  async trackShipment(trackingNumber: string): Promise<TrackingResult> {
    try {
      const response = await fetch(
        `${this.baseUrl}/v2/tracking/${encodeURIComponent(trackingNumber)}`,
        {
          method: "GET",
          headers: this.getHeaders(),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `TracxLogis API error: ${response.status} - ${errorText}`,
        );
      }

      const data = await response.json();
      return this.parseTrackingResponse(trackingNumber, data);
    } catch (error) {
      console.error("TracxLogis tracking error:", error);
      return {
        trackingNumber,
        status: "UNKNOWN",
        statusCode: "ERROR",
        carrier: "TracxLogis",
        events: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Track multiple shipments at once
   */
  async trackMultiple(trackingNumbers: string[]): Promise<TrackingResult[]> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/tracking/multi`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ tracking_numbers: trackingNumbers }),
      });

      if (!response.ok) {
        throw new Error(`TracxLogis API error: ${response.status}`);
      }

      const data = await response.json();
      return trackingNumbers.map((tn, idx) =>
        this.parseTrackingResponse(tn, data.results?.[idx] || data[idx]),
      );
    } catch (error) {
      console.error("TracxLogis multi-tracking error:", error);
      // Fallback to individual tracking
      return Promise.all(trackingNumbers.map((tn) => this.trackShipment(tn)));
    }
  }

  /**
   * Parse API response into our TrackingResult format
   */
  private parseTrackingResponse(
    trackingNumber: string,
    data: Record<string, unknown>,
  ): TrackingResult {
    const events: TrackingEvent[] = [];

    // Parse events/checkpoints from response
    const checkpoints = (data?.checkpoints ||
      data?.events ||
      data?.tracking_history ||
      []) as Array<Record<string, unknown>>;

    for (const checkpoint of checkpoints) {
      events.push({
        timestamp: String(
          checkpoint.time || checkpoint.timestamp || checkpoint.date || "",
        ),
        status: String(checkpoint.status || checkpoint.tag || ""),
        statusCode: String(checkpoint.status_code || checkpoint.tag || ""),
        location: String(
          checkpoint.location || checkpoint.city || checkpoint.country || "",
        ),
        description: String(
          checkpoint.message ||
            checkpoint.description ||
            checkpoint.status ||
            "",
        ),
      });
    }

    return {
      trackingNumber,
      status: String(data?.status || data?.tag || "UNKNOWN"),
      statusCode: String(data?.status_code || data?.tag || "UNKNOWN"),
      carrier: String(data?.carrier || data?.slug || "TracxLogis"),
      estimatedDelivery: data?.estimated_delivery_date as string | undefined,
      actualDelivery: data?.delivery_date as string | undefined,
      events,
      recipientName: data?.recipient_name as string | undefined,
      recipientAddress: data?.destination as string | undefined,
      weight: data?.weight as number | undefined,
    };
  }

  async createInventory(product: {
    name: string;
    sku: string;
    price?: number;
  }) {
    try {
      const url = `https://api.tracxlogis.com/GMKT.INC.GLPS.OpenApiService/SmartShipFulfillmentApiService.qapi/CreateInventory?key=QXAPIV1WUuovTlKz9HL51LPtw62ov_g_1_Eiey8wB11`;

      const payload = {
        inv: {
          inv_name: product.name,
          inv_option_name: "Default",
          seller_code: product.sku,
          currency: "PHP",
          unit_net_price: product.price || 0,
          unit_gst_price: product.price || 0,
          memo: "from logitrack",
        },
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.ResultCode !== 0) {
        throw new Error(data.ResultMsg);
      }
      console.log("create tracx  response:", data);

      return data.ResultObject; // 🔥 contains sku_no
    } catch (error) {
      console.error("TracX FULL ERROR:", JSON.stringify(error, null, 2));
      throw error;
    }
  }

  // send stock to tracxlogis when creating inventory batch in our system
  async sendStock(batch: {
    tracxSkuNo: string;
    quantity: number;
    warehouse?: string;
  }) {
    try {
      const url = `${this.baseUrl}/GMKT.INC.GLPS.OpenApiService/SmartShipFulfillmentApiService.qapi/SendStock?key=${this.apiKey}`;

      const payload = {
        cargoList: {
          pl_cd: batch.warehouse || "DEFAULT", // ⚠️ you must confirm real warehouse code later
          sku_list: [
            {
              sku_no: batch.tracxSkuNo,
              send_qty: batch.quantity,
            },
          ],
          memo: "from logitrack",
        },
      };

      console.log("SendStock payload:", payload);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.ResultCode !== 0) {
        throw new Error(data.ResultMsg);
      }
      
      return data.ResultObject;
    } catch (error) {
      console.error("SendStock error:", error);
      throw error;
    }
  }
}

/**
 * Get the active TracxLogis configuration from database
 */
export async function getActiveTracxConfig(): Promise<TracxLogisConfig | null> {
  const config = await prisma.tracxLogisConfig.findFirst({
    where: { isActive: true },
  });

  if (!config) {
    return null;
  }

  return {
    apiKey: config.apiKey,
    apiEndpoint: config.apiEndpoint,
  };
}

/**
 * Create a TracxLogis client using the active configuration
 */
export async function createTracxClient(): Promise<TracxLogisClient | null> {
  const config = await getActiveTracxConfig();
  if (!config) {
    return null;
  }
  return new TracxLogisClient(config);
}

/**
 * Sync shipment status from TracxLogis and update database
 */
export async function syncShipmentStatus(
  trackingNumber: string,
): Promise<TrackingResult | null> {
  const client = await createTracxClient();
  if (!client) {
    console.error("No active TracxLogis configuration found");
    return null;
  }

  const result = await client.trackShipment(trackingNumber);

  if (result.error) {
    console.error("Tracking error:", result.error);
    return result;
  }

  // Update shipment in database
  const internalStatus = mapTracxStatus(result.status);

  await prisma.shipment.update({
    where: { trackingNumber },
    data: {
      status: internalStatus,
      statusMessage: result.events[0]?.description || null,
      lastTrackingUpdate: new Date(),
      trackingHistory: result.events as object[],
      estimatedDelivery: result.estimatedDelivery
        ? new Date(result.estimatedDelivery)
        : undefined,
      actualDelivery: result.actualDelivery
        ? new Date(result.actualDelivery)
        : undefined,
      deliveredAt:
        internalStatus === "DELIVERED" && result.actualDelivery
          ? new Date(result.actualDelivery)
          : undefined,
      pickedUpAt:
        internalStatus === "PICKED_UP" ||
        ["IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"].includes(internalStatus)
          ? result.events.find(
              (e) => mapTracxStatus(e.statusCode) === "PICKED_UP",
            )?.timestamp
            ? new Date(
                result.events.find(
                  (e) => mapTracxStatus(e.statusCode) === "PICKED_UP",
                )!.timestamp,
              )
            : undefined
          : undefined,
    },
  });

  // Update order status if shipment is delivered
  if (internalStatus === "DELIVERED") {
    const shipment = await prisma.shipment.findUnique({
      where: { trackingNumber },
      select: { orderId: true },
    });

    if (shipment) {
      await prisma.order.update({
        where: { id: shipment.orderId },
        data: { status: "DELIVERED" },
      });
    }
  }

  return result;
}

/**
 * Sync all active shipments (non-delivered, non-failed)
 */
export async function syncAllActiveShipments(): Promise<{
  synced: number;
  errors: number;
}> {
  const activeShipments = await prisma.shipment.findMany({
    where: {
      status: {
        notIn: ["DELIVERED", "FAILED", "RETURNED"],
      },
    },
    select: { trackingNumber: true },
  });

  let synced = 0;
  let errors = 0;

  for (const shipment of activeShipments) {
    const result = await syncShipmentStatus(shipment.trackingNumber);
    if (result?.error) {
      errors++;
    } else {
      synced++;
    }
  }

  // Update last sync timestamp
  await prisma.tracxLogisConfig.updateMany({
    where: { isActive: true },
    data: { lastSyncAt: new Date() },
  });

  return { synced, errors };
}
