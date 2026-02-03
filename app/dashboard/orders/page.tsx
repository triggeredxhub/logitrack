'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardHeader } from '@/components/dashboard-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ShoppingCart,
  Plus,
  Search,
  Eye,
  Trash2,
  Loader2,
  MoreHorizontal,
  ArrowRight,
  Package,
  X,
} from 'lucide-react';
import {
  ORDER_STATUSES,
  ORDER_CHANNELS,
  ORDER_STATUS_TRANSITIONS,
  OrderStatus,
  OrderChannel,
  OrderWithItems,
  ProductWithStock,
} from '@/lib/types';
import { toast } from 'sonner';

interface InventoryBatchOption {
  id: string;
  batchNumber: string;
  quantity: number;
  product: {
    name: string;
    sku: string;
    sellingPrice: number | null;
  };
}

interface OrderItemForm {
  productName: string;
  sku: string;
  quantity: string;
  unitPrice: string;
  inventoryBatchId?: string;
}

const STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  PROCESSING: 'bg-purple-100 text-purple-800',
  SHIPPED: 'bg-indigo-100 text-indigo-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  REFUNDED: 'bg-gray-100 text-gray-800',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [batches, setBatches] = useState<InventoryBatchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');

  // Create order modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [orderForm, setOrderForm] = useState({
    channel: 'manual' as OrderChannel,
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    shippingAddress: '',
  });
  const [orderItems, setOrderItems] = useState<OrderItemForm[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // View order modal state
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (channelFilter) params.set('channel', channelFilter);

      const res = await fetch(`/api/orders?${params}`);
      const data = await res.json();
      if (data.success) {
        setOrders(data.data);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to fetch orders');
    }
  }, [search, statusFilter, channelFilter]);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products?activeOnly=true');
      const data = await res.json();
      if (data.success) {
        setProducts(data.data);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchBatches = async () => {
    try {
      const res = await fetch('/api/inventory');
      const data = await res.json();
      if (data.success) {
        setBatches(data.data.filter((b: InventoryBatchOption) => b.quantity > 0 && !('isExpired' in b && b.isExpired as boolean)));
      }
    } catch (error) {
      console.error('Error fetching batches:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchOrders(), fetchProducts(), fetchBatches()]);
      setLoading(false);
    };
    loadData();
  }, [fetchOrders]);

  const openCreateModal = () => {
    setOrderForm({
      channel: 'manual',
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      shippingAddress: '',
    });
    setOrderItems([{
      productName: '',
      sku: '',
      quantity: '1',
      unitPrice: '',
    }]);
    setCreateModalOpen(true);
  };

  const addOrderItem = () => {
    setOrderItems([...orderItems, {
      productName: '',
      sku: '',
      quantity: '1',
      unitPrice: '',
    }]);
  };

  const removeOrderItem = (index: number) => {
    if (orderItems.length > 1) {
      setOrderItems(orderItems.filter((_, i) => i !== index));
    }
  };

  const updateOrderItem = (index: number, field: keyof OrderItemForm, value: string) => {
    const updated = [...orderItems];
    updated[index] = { ...updated[index], [field]: value };

    // If selecting a batch, auto-fill product details
    if (field === 'inventoryBatchId' && value) {
      const batch = batches.find(b => b.id === value);
      if (batch) {
        updated[index].productName = batch.product.name;
        updated[index].sku = batch.product.sku;
        updated[index].unitPrice = batch.product.sellingPrice?.toString() || '';
      }
    }

    setOrderItems(updated);
  };

  const handleCreateOrder = async () => {
    // Validate items
    for (const item of orderItems) {
      if (!item.productName || !item.sku || !item.quantity || !item.unitPrice) {
        toast.error('Please fill in all item fields');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        channel: orderForm.channel,
        customerName: orderForm.customerName || undefined,
        customerEmail: orderForm.customerEmail || undefined,
        customerPhone: orderForm.customerPhone || undefined,
        shippingAddress: orderForm.shippingAddress || undefined,
        items: orderItems.map(item => ({
          productName: item.productName,
          sku: item.sku,
          quantity: parseInt(item.quantity),
          unitPrice: parseFloat(item.unitPrice),
          inventoryBatchId: item.inventoryBatchId || undefined,
        })),
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Order created successfully');
        setCreateModalOpen(false);
        fetchOrders();
        fetchBatches(); // Refresh inventory
      } else {
        toast.error(data.error || 'Failed to create order');
      }
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Order status updated to ${newStatus}`);
        fetchOrders();
        if (selectedOrder?.id === orderId) {
          setSelectedOrder(data.data);
        }
      } else {
        toast.error(data.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to delete this order?')) {
      return;
    }

    try {
      const res = await fetch(`/api/orders/${orderId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Order deleted');
        fetchOrders();
        fetchBatches();
      } else {
        toast.error(data.error || 'Failed to delete order');
      }
    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error('Failed to delete order');
    }
  };

  const viewOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      const data = await res.json();
      if (data.success) {
        setSelectedOrder(data.data);
        setViewModalOpen(true);
      }
    } catch (error) {
      console.error('Error fetching order:', error);
      toast.error('Failed to fetch order details');
    }
  };

  const calculateOrderTotal = () => {
    return orderItems.reduce((sum, item) => {
      const qty = parseInt(item.quantity) || 0;
      const price = parseFloat(item.unitPrice) || 0;
      return sum + qty * price;
    }, 0);
  };

  return (
    <>
      <DashboardHeader title="Orders" subtitle="Manage customer orders" />
      <div className="p-6">
        {/* Toolbar */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search orders..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 w-48"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {ORDER_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="All Channels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                {ORDER_CHANNELS.map((channel) => (
                  <SelectItem key={channel} value={channel}>
                    {channel.charAt(0).toUpperCase() + channel.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={openCreateModal}>
            <Plus className="mr-2 h-4 w-4" />
            Create Order
          </Button>
        </div>

        {/* Orders Table */}
        <div className="rounded-lg border bg-white shadow-sm">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <ShoppingCart className="h-8 w-8" />
                        <p>No orders found. Create your first order to get started.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-sm font-medium">
                        {order.orderNumber}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {order.channel.charAt(0).toUpperCase() + order.channel.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {order.customerName || '-'}
                        {order.customerEmail && (
                          <p className="text-xs text-gray-500">{order.customerEmail}</p>
                        )}
                      </TableCell>
                      <TableCell>{order.items.length} item(s)</TableCell>
                      <TableCell className="text-right font-medium">
                        {order.currency} {order.totalAmount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[order.status as OrderStatus]}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {new Date(order.orderDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => viewOrder(order.id)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            {ORDER_STATUS_TRANSITIONS[order.status as OrderStatus].map((nextStatus) => (
                              <DropdownMenuItem
                                key={nextStatus}
                                onClick={() => handleStatusChange(order.id, nextStatus)}
                              >
                                <ArrowRight className="mr-2 h-4 w-4" />
                                Mark as {nextStatus}
                              </DropdownMenuItem>
                            ))}
                            {['PENDING', 'CANCELLED'].includes(order.status) && (
                              <DropdownMenuItem
                                onClick={() => handleDeleteOrder(order.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Create Order Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Order</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Channel */}
            <div className="grid gap-2">
              <Label htmlFor="channel">Channel *</Label>
              <Select
                value={orderForm.channel}
                onValueChange={(value: OrderChannel) => setOrderForm({ ...orderForm, channel: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_CHANNELS.map((channel) => (
                    <SelectItem key={channel} value={channel}>
                      {channel.charAt(0).toUpperCase() + channel.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Customer Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="customerName">Customer Name</Label>
                <Input
                  id="customerName"
                  value={orderForm.customerName}
                  onChange={(e) => setOrderForm({ ...orderForm, customerName: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="customerEmail">Email</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  value={orderForm.customerEmail}
                  onChange={(e) => setOrderForm({ ...orderForm, customerEmail: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="customerPhone">Phone</Label>
                <Input
                  id="customerPhone"
                  value={orderForm.customerPhone}
                  onChange={(e) => setOrderForm({ ...orderForm, customerPhone: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="shippingAddress">Shipping Address</Label>
                <Input
                  id="shippingAddress"
                  value={orderForm.shippingAddress}
                  onChange={(e) => setOrderForm({ ...orderForm, shippingAddress: e.target.value })}
                />
              </div>
            </div>

            {/* Order Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Order Items *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addOrderItem}>
                  <Plus className="mr-1 h-3 w-3" />
                  Add Item
                </Button>
              </div>
              {orderItems.map((item, index) => (
                <div key={index} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Item {index + 1}</span>
                    {orderItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOrderItem(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label>From Inventory (optional)</Label>
                    <Select
                      value={item.inventoryBatchId || ''}
                      onValueChange={(value) => updateOrderItem(index, 'inventoryBatchId', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select batch or enter manually" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Enter manually</SelectItem>
                        {batches.map((batch) => (
                          <SelectItem key={batch.id} value={batch.id}>
                            {batch.product.name} - {batch.batchNumber} (Qty: {batch.quantity})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Product Name *</Label>
                      <Input
                        value={item.productName}
                        onChange={(e) => updateOrderItem(index, 'productName', e.target.value)}
                        placeholder="Product name"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>SKU *</Label>
                      <Input
                        value={item.sku}
                        onChange={(e) => updateOrderItem(index, 'sku', e.target.value)}
                        placeholder="SKU"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Quantity *</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateOrderItem(index, 'quantity', e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Unit Price *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateOrderItem(index, 'unitPrice', e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex justify-end text-lg font-semibold">
                Total: PHP {calculateOrderTotal().toFixed(2)}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateOrder} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Order Modal */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-6">
              {/* Order Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Order Number</p>
                  <p className="font-mono font-medium">{selectedOrder.orderNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <Badge className={STATUS_COLORS[selectedOrder.status as OrderStatus]}>
                    {selectedOrder.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Channel</p>
                  <Badge variant="outline">
                    {selectedOrder.channel.charAt(0).toUpperCase() + selectedOrder.channel.slice(1)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Order Date</p>
                  <p>{new Date(selectedOrder.orderDate).toLocaleString()}</p>
                </div>
              </div>

              {/* Customer Info */}
              <div>
                <h4 className="font-medium mb-2">Customer Information</h4>
                <div className="rounded-lg border p-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Name</p>
                    <p>{selectedOrder.customerName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Email</p>
                    <p>{selectedOrder.customerEmail || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Phone</p>
                    <p>{selectedOrder.customerPhone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Address</p>
                    <p>{selectedOrder.shippingAddress || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div>
                <h4 className="font-medium mb-2">Order Items</h4>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrder.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-gray-400" />
                              {item.productName}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">
                            {selectedOrder.currency} {item.unitPrice.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {selectedOrder.currency} {item.totalPrice.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={4} className="text-right font-semibold">
                          Total
                        </TableCell>
                        <TableCell className="text-right font-bold text-lg">
                          {selectedOrder.currency} {selectedOrder.totalAmount.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Status Actions */}
              {ORDER_STATUS_TRANSITIONS[selectedOrder.status as OrderStatus].length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Update Status</h4>
                  <div className="flex gap-2">
                    {ORDER_STATUS_TRANSITIONS[selectedOrder.status as OrderStatus].map((nextStatus) => (
                      <Button
                        key={nextStatus}
                        variant={nextStatus === 'CANCELLED' ? 'destructive' : 'outline'}
                        onClick={() => handleStatusChange(selectedOrder.id, nextStatus)}
                      >
                        <ArrowRight className="mr-2 h-4 w-4" />
                        {nextStatus}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
