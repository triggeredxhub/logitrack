import { prisma } from './db';
import { createShopeeClient, mapShopeeStatus, ShopeeOrder } from './shopee-client';

export interface SyncResult {
  success: boolean;
  ordersImported: number;
  ordersSkipped: number;
  errors: string[];
}

/**
 * Import Shopee orders into the local database
 * This is READ-ONLY - it never writes back to Shopee
 * It also NEVER directly modifies inventory
 */
export async function syncShopeeOrders(
  configId: string,
  daysBack = 7
): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    ordersImported: 0,
    ordersSkipped: 0,
    errors: [],
  };

  // Create sync log entry
  const syncLog = await prisma.syncLog.create({
    data: {
      shopeeConfigId: configId,
      syncType: 'orders',
      status: 'started',
    },
  });

  try {
    const client = await createShopeeClient(configId);
    if (!client) {
      throw new Error('Failed to create Shopee client');
    }

    // Calculate time range
    const timeTo = Math.floor(Date.now() / 1000);
    const timeFrom = timeTo - daysBack * 24 * 60 * 60;

    let cursor: string | undefined;
    let hasMore = true;
    const allOrderSns: string[] = [];

    // Fetch all order SNs
    while (hasMore) {
      const listResponse = await client.getOrderList(
        'create_time',
        timeFrom,
        timeTo,
        50,
        cursor
      );

      if (listResponse.error) {
        throw new Error(`Failed to fetch order list: ${listResponse.message}`);
      }

      if (listResponse.response?.order_list) {
        allOrderSns.push(...listResponse.response.order_list.map((o) => o.order_sn));
      }

      hasMore = listResponse.response?.more || false;
      cursor = listResponse.response?.next_cursor;
    }

    console.log(`Found ${allOrderSns.length} orders to process`);

    // Process orders in batches of 50 (Shopee API limit)
    const batchSize = 50;
    for (let i = 0; i < allOrderSns.length; i += batchSize) {
      const batch = allOrderSns.slice(i, i + batchSize);

      const detailsResponse = await client.getOrderDetails(batch);

      if (detailsResponse.error) {
        result.errors.push(`Failed to fetch order details: ${detailsResponse.message}`);
        continue;
      }

      if (!detailsResponse.response?.order_list) {
        continue;
      }

      // Process each order
      for (const shopeeOrder of detailsResponse.response.order_list) {
        try {
          const imported = await importShopeeOrder(shopeeOrder);
          if (imported) {
            result.ordersImported++;
          } else {
            result.ordersSkipped++;
          }
        } catch (err) {
          const error = err instanceof Error ? err.message : 'Unknown error';
          result.errors.push(`Failed to import order ${shopeeOrder.order_sn}: ${error}`);
          result.ordersSkipped++;
        }
      }
    }

    // Update sync log and config
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'completed',
        ordersImported: result.ordersImported,
        ordersSkipped: result.ordersSkipped,
        errorMessage: result.errors.length > 0 ? result.errors.join('; ') : null,
        completedAt: new Date(),
      },
    });

    await prisma.shopeeConfig.update({
      where: { id: configId },
      data: { lastSyncAt: new Date() },
    });

    result.success = true;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    result.errors.push(errorMessage);

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'failed',
        ordersImported: result.ordersImported,
        ordersSkipped: result.ordersSkipped,
        errorMessage: errorMessage,
        completedAt: new Date(),
      },
    });
  }

  return result;
}

/**
 * Import a single Shopee order into the local database
 * Returns true if imported, false if skipped (already exists)
 */
async function importShopeeOrder(shopeeOrder: ShopeeOrder): Promise<boolean> {
  // Check if order already exists
  const existingOrder = await prisma.order.findFirst({
    where: { externalOrderId: shopeeOrder.order_sn },
  });

  if (existingOrder) {
    // Update existing order status if changed
    const newStatus = mapShopeeStatus(shopeeOrder.order_status);
    if (existingOrder.status !== newStatus) {
      await prisma.order.update({
        where: { id: existingOrder.id },
        data: { status: newStatus },
      });
    }
    return false; // Skipped (already exists, just updated status)
  }

  // Build shipping address
  const address = shopeeOrder.recipient_address;
  const shippingAddress = [
    address.full_address,
    address.district,
    address.city,
    address.state,
    address.region,
    address.zipcode,
  ]
    .filter(Boolean)
    .join(', ');

  // Calculate total from items
  const totalAmount = shopeeOrder.total_amount;

  // Create order with items
  await prisma.order.create({
    data: {
      orderNumber: `SPE-${shopeeOrder.order_sn}`,
      channel: 'shopee',
      status: mapShopeeStatus(shopeeOrder.order_status),
      customerName: address.name || shopeeOrder.buyer_username,
      customerPhone: address.phone,
      shippingAddress: shippingAddress || null,
      totalAmount,
      currency: shopeeOrder.currency || 'PHP',
      externalOrderId: shopeeOrder.order_sn,
      orderDate: new Date(shopeeOrder.create_time * 1000),
      items: {
        create: shopeeOrder.item_list.map((item) => ({
          // NOTE: We do NOT link to inventoryBatchId here
          // This is intentional - Shopee orders are read-only imports
          // Inventory deduction should be done manually or through a separate process
          productName: item.item_name,
          sku: item.model_sku || item.item_sku || `SHOPEE-${item.item_id}`,
          quantity: item.model_quantity_purchased,
          unitPrice: item.model_discounted_price,
          totalPrice: item.model_discounted_price * item.model_quantity_purchased,
        })),
      },
    },
  });

  return true;
}

/**
 * Get sync history for a Shopee config
 */
export async function getSyncHistory(configId: string, limit = 10) {
  return prisma.syncLog.findMany({
    where: { shopeeConfigId: configId },
    orderBy: { startedAt: 'desc' },
    take: limit,
  });
}
