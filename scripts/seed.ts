import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Create test user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'admin@logitrack.com' },
    update: {},
    create: {
      email: 'admin@logitrack.com',
      name: 'Admin User',
      password: hashedPassword,
    },
  });
  console.log('✅ User created:', user.email);

  // Create sample products
  const products = await Promise.all([
    prisma.product.upsert({
      where: { sku: 'PROD-001' },
      update: {},
      create: {
        name: 'Vitamin C Supplement',
        sku: 'PROD-001',
        description: '1000mg Vitamin C tablets',
        category: 'Health & Beauty',
        reorderLevel: 50,
        sellingPrice: 15.99,
      },
    }),
    prisma.product.upsert({
      where: { sku: 'PROD-002' },
      update: {},
      create: {
        name: 'Organic Green Tea',
        sku: 'PROD-002',
        description: 'Premium organic green tea bags',
        category: 'Food & Beverages',
        reorderLevel: 100,
        sellingPrice: 12.50,
      },
    }),
    prisma.product.upsert({
      where: { sku: 'PROD-003' },
      update: {},
      create: {
        name: 'Face Moisturizer',
        sku: 'PROD-003',
        description: 'Hydrating face cream 50ml',
        category: 'Health & Beauty',
        reorderLevel: 30,
        sellingPrice: 24.99,
      },
    }),
    prisma.product.upsert({
      where: { sku: 'PROD-004' },
      update: {},
      create: {
        name: 'Wireless Mouse',
        sku: 'PROD-004',
        description: 'Ergonomic wireless mouse',
        category: 'Electronics',
        reorderLevel: 20,
        sellingPrice: 29.99,
      },
    }),
    prisma.product.upsert({
      where: { sku: 'PROD-005' },
      update: {},
      create: {
        name: 'Protein Bars',
        sku: 'PROD-005',
        description: 'High protein energy bars - Box of 12',
        category: 'Food & Beverages',
        reorderLevel: 80,
        sellingPrice: 35.00,
      },
    }),
  ]);
  console.log(`✅ Created ${products.length} products`);

  // Create sample batches with various expiry states
  const now = new Date();
  const batches = await Promise.all([
    // Vitamin C - Multiple batches, some expiring soon
    prisma.inventoryBatch.upsert({
      where: { productId_batchNumber: { productId: products[0].id, batchNumber: 'BATCH-VC-001' } },
      update: {},
      create: {
        productId: products[0].id,
        batchNumber: 'BATCH-VC-001',
        quantity: 200,
        expiryDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000), // 1 year
        location: 'Warehouse A, Shelf 1',
        costPrice: 8.00,
      },
    }),
    prisma.inventoryBatch.upsert({
      where: { productId_batchNumber: { productId: products[0].id, batchNumber: 'BATCH-VC-002' } },
      update: {},
      create: {
        productId: products[0].id,
        batchNumber: 'BATCH-VC-002',
        quantity: 50,
        expiryDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // 14 days - expiring soon
        location: 'Warehouse A, Shelf 1',
        costPrice: 7.50,
      },
    }),
    // Green Tea - Low stock
    prisma.inventoryBatch.upsert({
      where: { productId_batchNumber: { productId: products[1].id, batchNumber: 'BATCH-GT-001' } },
      update: {},
      create: {
        productId: products[1].id,
        batchNumber: 'BATCH-GT-001',
        quantity: 30, // Below reorder level of 100
        expiryDate: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000), // 6 months
        location: 'Warehouse B, Shelf 3',
        costPrice: 6.00,
      },
    }),
    // Face Moisturizer - Expired batch
    prisma.inventoryBatch.upsert({
      where: { productId_batchNumber: { productId: products[2].id, batchNumber: 'BATCH-FM-001' } },
      update: {},
      create: {
        productId: products[2].id,
        batchNumber: 'BATCH-FM-001',
        quantity: 25,
        expiryDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days ago - expired
        isExpired: true,
        location: 'Warehouse A, Shelf 5',
        costPrice: 12.00,
      },
    }),
    prisma.inventoryBatch.upsert({
      where: { productId_batchNumber: { productId: products[2].id, batchNumber: 'BATCH-FM-002' } },
      update: {},
      create: {
        productId: products[2].id,
        batchNumber: 'BATCH-FM-002',
        quantity: 100,
        expiryDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000), // 3 months
        location: 'Warehouse A, Shelf 5',
        costPrice: 13.00,
      },
    }),
    // Wireless Mouse - No expiry
    prisma.inventoryBatch.upsert({
      where: { productId_batchNumber: { productId: products[3].id, batchNumber: 'BATCH-WM-001' } },
      update: {},
      create: {
        productId: products[3].id,
        batchNumber: 'BATCH-WM-001',
        quantity: 75,
        location: 'Warehouse C, Shelf 2',
        costPrice: 15.00,
      },
    }),
    // Protein Bars - Critical low stock and expiring
    prisma.inventoryBatch.upsert({
      where: { productId_batchNumber: { productId: products[4].id, batchNumber: 'BATCH-PB-001' } },
      update: {},
      create: {
        productId: products[4].id,
        batchNumber: 'BATCH-PB-001',
        quantity: 10, // Way below reorder level of 80
        expiryDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days - critical
        location: 'Warehouse B, Shelf 1',
        costPrice: 18.00,
      },
    }),
  ]);
  console.log(`✅ Created ${batches.length} inventory batches`);

  // Create sample orders
  const orders = await Promise.all([
    prisma.order.upsert({
      where: { orderNumber: 'ORD-SAMPLE-001' },
      update: {},
      create: {
        orderNumber: 'ORD-SAMPLE-001',
        channel: 'shopee',
        status: 'DELIVERED',
        customerName: 'Maria Santos',
        customerEmail: 'maria@example.com',
        customerPhone: '+63 912 345 6789',
        shippingAddress: '123 Main St, Manila, Philippines',
        totalAmount: 47.97,
        currency: 'PHP',
        orderDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        items: {
          create: [
            {
              productName: 'Vitamin C Supplement',
              sku: 'PROD-001',
              quantity: 3,
              unitPrice: 15.99,
              totalPrice: 47.97,
            },
          ],
        },
      },
    }),
    prisma.order.upsert({
      where: { orderNumber: 'ORD-SAMPLE-002' },
      update: {},
      create: {
        orderNumber: 'ORD-SAMPLE-002',
        channel: 'manual',
        status: 'PROCESSING',
        customerName: 'Juan Dela Cruz',
        customerEmail: 'juan@example.com',
        customerPhone: '+63 923 456 7890',
        shippingAddress: '456 Oak Ave, Quezon City, Philippines',
        totalAmount: 54.98,
        currency: 'PHP',
        orderDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        items: {
          create: [
            {
              productName: 'Wireless Mouse',
              sku: 'PROD-004',
              quantity: 1,
              unitPrice: 29.99,
              totalPrice: 29.99,
            },
            {
              productName: 'Face Moisturizer',
              sku: 'PROD-003',
              quantity: 1,
              unitPrice: 24.99,
              totalPrice: 24.99,
            },
          ],
        },
      },
    }),
    prisma.order.upsert({
      where: { orderNumber: 'ORD-SAMPLE-003' },
      update: {},
      create: {
        orderNumber: 'ORD-SAMPLE-003',
        channel: 'shopee',
        status: 'PENDING',
        customerName: 'Ana Reyes',
        customerEmail: 'ana@example.com',
        customerPhone: '+63 934 567 8901',
        shippingAddress: '789 Pine Rd, Makati, Philippines',
        totalAmount: 70.00,
        currency: 'PHP',
        orderDate: new Date(), // Today
        items: {
          create: [
            {
              productName: 'Protein Bars',
              sku: 'PROD-005',
              quantity: 2,
              unitPrice: 35.00,
              totalPrice: 70.00,
            },
          ],
        },
      },
    }),
  ]);
  console.log(`✅ Created ${orders.length} sample orders`);

  // Create sample shipments for delivered orders
  const deliveredOrder = await prisma.order.findUnique({
    where: { orderNumber: 'ORD-SAMPLE-001' },
  });

  if (deliveredOrder) {
    await prisma.shipment.upsert({
      where: { orderId: deliveredOrder.id },
      update: {},
      create: {
        orderId: deliveredOrder.id,
        trackingNumber: 'TXL001234567SG',
        carrier: 'TracxLogis',
        status: 'DELIVERED',
        statusMessage: 'Package delivered successfully',
        estimatedDelivery: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        actualDelivery: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
        shippedAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
        pickedUpAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
        deliveredAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
        recipientName: 'Maria Santos',
        recipientAddress: '123 Main St, Manila, Philippines',
        trackingHistory: [
          {
            timestamp: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'DELIVERED',
            statusCode: 'DELIVERED',
            location: 'Manila, Philippines',
            description: 'Package delivered and signed by recipient',
          },
          {
            timestamp: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000 - 3 * 60 * 60 * 1000).toISOString(),
            status: 'OUT_FOR_DELIVERY',
            statusCode: 'OUT_FOR_DELIVERY',
            location: 'Manila Hub',
            description: 'Out for delivery',
          },
          {
            timestamp: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'IN_TRANSIT',
            statusCode: 'IN_TRANSIT',
            location: 'Manila Hub',
            description: 'Arrived at destination hub',
          },
          {
            timestamp: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'PICKED_UP',
            statusCode: 'PICKED_UP',
            location: 'Singapore',
            description: 'Package picked up from sender',
          },
        ],
      },
    });
    console.log('✅ Created shipment for ORD-SAMPLE-001');
  }

  // Create an in-transit shipment
  const processingOrder = await prisma.order.findUnique({
    where: { orderNumber: 'ORD-SAMPLE-002' },
  });

  if (processingOrder) {
    // Update order to SHIPPED
    await prisma.order.update({
      where: { id: processingOrder.id },
      data: { status: 'SHIPPED' },
    });

    await prisma.shipment.upsert({
      where: { orderId: processingOrder.id },
      update: {},
      create: {
        orderId: processingOrder.id,
        trackingNumber: 'TXL002345678SG',
        carrier: 'TracxLogis',
        status: 'IN_TRANSIT',
        statusMessage: 'Package in transit to destination',
        estimatedDelivery: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
        shippedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        pickedUpAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        recipientName: 'Juan Dela Cruz',
        recipientAddress: '456 Oak Ave, Quezon City, Philippines',
        trackingHistory: [
          {
            timestamp: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
            status: 'IN_TRANSIT',
            statusCode: 'IN_TRANSIT',
            location: 'Singapore Hub',
            description: 'Departed facility',
          },
          {
            timestamp: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'PICKED_UP',
            statusCode: 'PICKED_UP',
            location: 'Singapore',
            description: 'Package picked up from sender',
          },
        ],
      },
    });
    console.log('✅ Created shipment for ORD-SAMPLE-002 (in transit)');
  }

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
