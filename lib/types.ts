// Product types
export type Product = {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  category: string | null;
  reorderLevel: number;
  sellingPrice: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ProductWithStock = Product & {
  totalStock: number;
  isLowStock: boolean;
  batchCount: number;
};

export type CreateProductInput = {
  name: string;
  sku: string;
  description?: string;
  category?: string;
  reorderLevel?: number;
  sellingPrice?: number;
};

export type UpdateProductInput = Partial<CreateProductInput> & {
  isActive?: boolean;
};

// Inventory Batch types
export type InventoryBatch = {
  id: string;
  productId: string;
  batchNumber: string;
  quantity: number;
  expiryDate: Date | null;
  isExpired: boolean;
  location: string | null;
  costPrice: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type InventoryBatchWithProduct = InventoryBatch & {
  product: Product;
  isExpiringSoon: boolean;
  daysUntilExpiry: number | null;
};

export type CreateInventoryBatchInput = {
  productId: string;
  batchNumber: string;
  quantity: number;
  expiryDate?: string;
  location?: string;
  costPrice?: number;
  notes?: string;
};

export type UpdateInventoryBatchInput = Partial<Omit<CreateInventoryBatchInput, 'productId'>>;

// Low stock alert type
export type LowStockAlert = {
  product: Product;
  totalStock: number;
  reorderLevel: number;
  deficit: number;
};

// Expiry alert type
export type ExpiryAlert = {
  batch: InventoryBatchWithProduct;
  status: 'expired' | 'expiring_soon' | 'expiring_this_week' | 'expiring_this_month';
  daysUntilExpiry: number | null;
};

// API Response types
export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

export type PaginatedResponse<T> = ApiResponse<T> & {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

// Date range type
export type DateRange = {
  from: Date | undefined;
  to: Date | undefined;
};

// Product categories
export const PRODUCT_CATEGORIES = [
  'Electronics',
  'Clothing',
  'Food & Beverages',
  'Health & Beauty',
  'Home & Garden',
  'Sports & Outdoors',
  'Toys & Games',
  'Books & Media',
  'Automotive',
  'Office Supplies',
  'Other'
] as const;

// Expiry threshold in days
export const EXPIRY_THRESHOLDS = {
  EXPIRED: 0,
  EXPIRING_SOON: 7,
  EXPIRING_THIS_WEEK: 7,
  EXPIRING_THIS_MONTH: 30,
} as const;

// Order types
export const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
] as const;

export type OrderStatus = typeof ORDER_STATUSES[number];

export const ORDER_CHANNELS = [
  'shopee',
  'manual',
] as const;

export type OrderChannel = typeof ORDER_CHANNELS[number];

// Valid status transitions
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

export type OrderItem = {
  id: string;
  orderId: string;
  inventoryBatchId: string | null;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  createdAt: Date;
};

export type Order = {
  id: string;
  orderNumber: string;
  channel: string;
  status: OrderStatus;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  shippingAddress: string | null;
  totalAmount: number;
  currency: string;
  externalOrderId: string | null;
  orderDate: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type OrderWithItems = Order & {
  items: OrderItem[];
};

export type CreateOrderItemInput = {
  productId?: string;
  inventoryBatchId?: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
};

export type CreateOrderInput = {
  channel: OrderChannel;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress?: string;
  currency?: string;
  orderDate?: string;
  items: CreateOrderItemInput[];
};

export type UpdateOrderInput = {
  status?: OrderStatus;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress?: string;
};

export type AddOrderItemInput = CreateOrderItemInput;

// Shopee types
export type ShopeeConfig = {
  id: string;
  shopId: string;
  shopName: string | null;
  partnerId: string;
  isActive: boolean;
  isTokenValid: boolean;
  tokenExpiresAt: Date | null;
  lastSyncAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SyncLog = {
  id: string;
  shopeeConfigId: string;
  syncType: string;
  status: 'started' | 'completed' | 'failed';
  ordersImported: number;
  ordersSkipped: number;
  errorMessage: string | null;
  startedAt: Date;
  completedAt: Date | null;
};

export type SyncResult = {
  success: boolean;
  ordersImported: number;
  ordersSkipped: number;
  errors: string[];
};