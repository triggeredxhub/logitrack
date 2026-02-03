'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardHeader } from '@/components/dashboard-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Truck,
  Package,
  Search,
  Plus,
  RefreshCw,
  MoreHorizontal,
  Eye,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Settings,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';

interface Order {
  id: string;
  orderNumber: string;
  customerName: string | null;
  totalAmount: string;
  status: string;
}

interface Shipment {
  id: string;
  orderId: string;
  trackingNumber: string;
  carrier: string;
  status: string;
  statusMessage: string | null;
  estimatedDelivery: string | null;
  actualDelivery: string | null;
  shippedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  lastTrackingUpdate: string | null;
  trackingHistory: TrackingEvent[] | null;
  recipientName: string | null;
  recipientAddress: string | null;
  weight: string | null;
  createdAt: string;
  order: Order;
}

interface TrackingEvent {
  timestamp: string;
  status: string;
  statusCode: string;
  location: string;
  description: string;
}

interface TracxLogisConfig {
  id: string;
  name: string;
  apiEndpoint: string;
  isActive: boolean;
  lastSyncAt: string | null;
  createdAt: string;
}

const SHIPMENT_STATUSES = [
  { value: 'PENDING', label: 'Pending', color: 'bg-gray-100 text-gray-800' },
  { value: 'PICKED_UP', label: 'Picked Up', color: 'bg-blue-100 text-blue-800' },
  { value: 'IN_TRANSIT', label: 'In Transit', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', color: 'bg-orange-100 text-orange-800' },
  { value: 'DELIVERED', label: 'Delivered', color: 'bg-green-100 text-green-800' },
  { value: 'FAILED', label: 'Failed', color: 'bg-red-100 text-red-800' },
  { value: 'RETURNED', label: 'Returned', color: 'bg-purple-100 text-purple-800' },
];

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [configs, setConfigs] = useState<TracxLogisConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  
  // Form state
  const [createForm, setCreateForm] = useState({
    orderId: '',
    trackingNumber: '',
    carrier: 'TracxLogis',
    estimatedDelivery: '',
  });
  const [configForm, setConfigForm] = useState({
    name: '',
    apiKey: '',
    apiEndpoint: 'https://api.tracxlogis.com',
  });

  const fetchShipments = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      
      const res = await fetch(`/api/shipments?${params}`);
      const data = await res.json();
      setShipments(data.shipments || []);
    } catch (error) {
      console.error('Error fetching shipments:', error);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  const fetchOrders = async () => {
    try {
      // Fetch orders without shipments for creating new shipments
      const res = await fetch('/api/orders');
      const data = await res.json();
      // Filter to only show orders that don't have shipments yet
      const ordersWithoutShipment = (data.orders || []).filter(
        (o: { shipment?: unknown; status: string }) => !o.shipment && ['CONFIRMED', 'PROCESSING'].includes(o.status)
      );
      setOrders(ordersWithoutShipment);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const fetchConfigs = async () => {
    try {
      const res = await fetch('/api/shipments/config');
      const data = await res.json();
      setConfigs(data.configs || []);
    } catch (error) {
      console.error('Error fetching configs:', error);
    }
  };

  useEffect(() => {
    fetchShipments();
    fetchOrders();
    fetchConfigs();
  }, [fetchShipments]);

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.error || 'Failed to create shipment');
        return;
      }

      setCreateModalOpen(false);
      setCreateForm({ orderId: '', trackingNumber: '', carrier: 'TracxLogis', estimatedDelivery: '' });
      fetchShipments();
      fetchOrders();
    } catch (error) {
      console.error('Error creating shipment:', error);
      alert('Failed to create shipment');
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync-all' }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Sync failed');
      } else {
        alert(`Synced ${data.synced} shipments${data.errors > 0 ? `, ${data.errors} errors` : ''}`);
        fetchShipments();
      }
    } catch (error) {
      console.error('Error syncing:', error);
      alert('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncSingle = async (shipment: Shipment) => {
    try {
      const res = await fetch(`/api/shipments/${shipment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Sync failed');
      } else {
        fetchShipments();
        if (selectedShipment?.id === shipment.id) {
          setSelectedShipment(data.shipment);
        }
      }
    } catch (error) {
      console.error('Error syncing:', error);
      alert('Sync failed');
    }
  };

  const handleDeleteShipment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this shipment?')) return;

    try {
      const res = await fetch(`/api/shipments/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const error = await res.json();
        alert(error.error || 'Failed to delete shipment');
        return;
      }
      fetchShipments();
      fetchOrders();
    } catch (error) {
      console.error('Error deleting shipment:', error);
      alert('Failed to delete shipment');
    }
  };

  const handleSaveConfig = async () => {
    try {
      const res = await fetch('/api/shipments/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configForm),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.error || 'Failed to save config');
        return;
      }

      setConfigModalOpen(false);
      setConfigForm({ name: '', apiKey: '', apiEndpoint: 'https://api.tracxlogis.com' });
      fetchConfigs();
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Failed to save config');
    }
  };

  const handleDeleteConfig = async (id: string) => {
    if (!confirm('Are you sure you want to delete this configuration?')) return;

    try {
      const res = await fetch(`/api/shipments/config?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        alert('Failed to delete configuration');
        return;
      }
      fetchConfigs();
    } catch (error) {
      console.error('Error deleting config:', error);
      alert('Failed to delete config');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = SHIPMENT_STATUSES.find(s => s.value === status);
    return (
      <Badge className={statusConfig?.color || 'bg-gray-100 text-gray-800'}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'FAILED':
      case 'RETURNED':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'OUT_FOR_DELIVERY':
        return <Truck className="h-5 w-5 text-orange-600" />;
      case 'IN_TRANSIT':
        return <Package className="h-5 w-5 text-yellow-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  // Stats
  const stats = {
    total: shipments.length,
    inTransit: shipments.filter(s => ['IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(s.status)).length,
    delivered: shipments.filter(s => s.status === 'DELIVERED').length,
    issues: shipments.filter(s => ['FAILED', 'RETURNED'].includes(s.status)).length,
  };

  const hasActiveConfig = configs.some(c => c.isActive);

  return (
    <>
      <DashboardHeader title="Shipments" subtitle="Track shipments and deliveries" />
      <div className="p-6">
        <Tabs defaultValue="shipments" className="space-y-6">
          <TabsList>
            <TabsTrigger value="shipments" className="flex items-center gap-2">
              <Truck className="h-4 w-4" /> Shipments
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" /> TracxLogis Settings
            </TabsTrigger>
          </TabsList>

          {/* Shipments Tab */}
          <TabsContent value="shipments" className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Package className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total Shipments</p>
                      <p className="text-2xl font-bold">{stats.total}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <Truck className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">In Transit</p>
                      <p className="text-2xl font-bold">{stats.inTransit}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Delivered</p>
                      <p className="text-2xl font-bold">{stats.delivered}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Issues</p>
                      <p className="text-2xl font-bold">{stats.issues}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 justify-between">
              <div className="flex gap-4 flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search tracking number, order..."
                    className="pl-10"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {SHIPMENT_STATUSES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleSyncAll}
                  disabled={syncing || !hasActiveConfig}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                  Sync All
                </Button>
                <Button onClick={() => setCreateModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Create Shipment
                </Button>
              </div>
            </div>

            {/* No Config Warning */}
            {!hasActiveConfig && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <div className="flex-1">
                  <p className="font-medium text-amber-800">No TracxLogis API configured</p>
                  <p className="text-sm text-amber-600">Configure your API key in the Settings tab to enable tracking sync.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setConfigModalOpen(true)}>
                  Configure
                </Button>
              </div>
            )}

            {/* Shipments Table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tracking Number</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Carrier</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Est. Delivery</TableHead>
                      <TableHead>Last Update</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : shipments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                          No shipments found
                        </TableCell>
                      </TableRow>
                    ) : (
                      shipments.map((shipment) => (
                        <TableRow key={shipment.id}>
                          <TableCell className="font-mono font-medium">
                            {shipment.trackingNumber}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p className="font-medium">{shipment.order.orderNumber}</p>
                              <p className="text-gray-500">{shipment.order.customerName}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p>{shipment.recipientName || '-'}</p>
                              {shipment.recipientAddress && (
                                <p className="text-gray-500 truncate max-w-[200px]">
                                  {shipment.recipientAddress}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{shipment.carrier}</TableCell>
                          <TableCell>{getStatusBadge(shipment.status)}</TableCell>
                          <TableCell>
                            {shipment.estimatedDelivery
                              ? format(new Date(shipment.estimatedDelivery), 'MMM d, yyyy')
                              : '-'}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {shipment.lastTrackingUpdate
                              ? format(new Date(shipment.lastTrackingUpdate), 'MMM d, HH:mm')
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => {
                                  setSelectedShipment(shipment);
                                  setViewModalOpen(true);
                                }}>
                                  <Eye className="h-4 w-4 mr-2" /> View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleSyncSingle(shipment)}
                                  disabled={!hasActiveConfig}
                                >
                                  <RefreshCw className="h-4 w-4 mr-2" /> Sync Tracking
                                </DropdownMenuItem>
                                {shipment.status === 'PENDING' && (
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteShipment(shipment.id)}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" /> Delete
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  TracxLogis API Configuration
                </CardTitle>
                <CardDescription>
                  Configure your TracxLogis API credentials to enable shipment tracking.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm mb-6">
                  <h4 className="font-semibold text-blue-800 mb-2">📋 Getting Your API Key</h4>
                  <ol className="list-decimal list-inside space-y-1 text-blue-700">
                    <li>Go to <a href="https://api.tracxlogis.com" target="_blank" rel="noopener noreferrer" className="underline">TracxLogis Developer Portal</a></li>
                    <li>Create an account or log in</li>
                    <li>Navigate to API Certification → My API Key</li>
                    <li>Copy your API key and paste it below</li>
                  </ol>
                </div>

                {configs.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="p-3 bg-gray-100 rounded-full w-fit mx-auto mb-4">
                      <Settings className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500 mb-4">No API configuration found</p>
                    <Button onClick={() => setConfigModalOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" /> Add Configuration
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {configs.map(config => (
                      <div
                        key={config.id}
                        className={`p-4 rounded-lg border ${config.isActive ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {config.isActive && (
                              <Badge className="bg-green-100 text-green-800">Active</Badge>
                            )}
                            <div>
                              <p className="font-medium">{config.name}</p>
                              <p className="text-sm text-gray-500">{config.apiEndpoint}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            {config.lastSyncAt && (
                              <p className="text-sm text-gray-500">
                                Last sync: {format(new Date(config.lastSyncAt), 'MMM d, HH:mm')}
                              </p>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteConfig(config.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" onClick={() => setConfigModalOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" /> Add Another Configuration
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Shipment Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Shipment</DialogTitle>
            <DialogDescription>
              Link a tracking number to an order.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="orderId">Order *</Label>
              <Select
                value={createForm.orderId}
                onValueChange={(value) => setCreateForm({ ...createForm, orderId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an order" />
                </SelectTrigger>
                <SelectContent>
                  {orders.length === 0 ? (
                    <SelectItem value="none" disabled>No orders available</SelectItem>
                  ) : (
                    orders.map(order => (
                      <SelectItem key={order.id} value={order.id}>
                        {order.orderNumber} - {order.customerName || 'No name'}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Only CONFIRMED or PROCESSING orders without shipments are shown</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="trackingNumber">Tracking Number *</Label>
              <Input
                id="trackingNumber"
                placeholder="e.g., TXL123456789"
                value={createForm.trackingNumber}
                onChange={(e) => setCreateForm({ ...createForm, trackingNumber: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="carrier">Carrier</Label>
              <Input
                id="carrier"
                placeholder="TracxLogis"
                value={createForm.carrier}
                onChange={(e) => setCreateForm({ ...createForm, carrier: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="estimatedDelivery">Estimated Delivery</Label>
              <Input
                id="estimatedDelivery"
                type="date"
                value={createForm.estimatedDelivery}
                onChange={(e) => setCreateForm({ ...createForm, estimatedDelivery: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateModalOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={!createForm.orderId || !createForm.trackingNumber}
            >
              Create Shipment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Shipment Modal */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedShipment && getStatusIcon(selectedShipment.status)}
              Shipment Details
            </DialogTitle>
          </DialogHeader>
          {selectedShipment && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Tracking Number</p>
                  <p className="font-mono font-medium flex items-center gap-2">
                    {selectedShipment.trackingNumber}
                    <a
                      href={`https://www.tracxlogis.com/tracking?trackingNo=${selectedShipment.trackingNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-700"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  {getStatusBadge(selectedShipment.status)}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Order</p>
                  <p className="font-medium">{selectedShipment.order.orderNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Carrier</p>
                  <p>{selectedShipment.carrier}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Recipient</p>
                  <p>{selectedShipment.recipientName || selectedShipment.order.customerName || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Est. Delivery</p>
                  <p>
                    {selectedShipment.estimatedDelivery
                      ? format(new Date(selectedShipment.estimatedDelivery), 'MMM d, yyyy')
                      : '-'}
                  </p>
                </div>
              </div>

              {/* Address */}
              {selectedShipment.recipientAddress && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Delivery Address</p>
                  <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                    <p className="text-sm">{selectedShipment.recipientAddress}</p>
                  </div>
                </div>
              )}

              {/* Tracking History */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="font-medium">Tracking History</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSyncSingle(selectedShipment)}
                    disabled={!hasActiveConfig}
                  >
                    <RefreshCw className="h-3 w-3 mr-2" /> Refresh
                  </Button>
                </div>
                {selectedShipment.trackingHistory && selectedShipment.trackingHistory.length > 0 ? (
                  <div className="space-y-4">
                    {selectedShipment.trackingHistory.map((event, idx) => (
                      <div key={idx} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`w-3 h-3 rounded-full ${
                            idx === 0 ? 'bg-blue-500' : 'bg-gray-300'
                          }`} />
                          {idx < selectedShipment.trackingHistory!.length - 1 && (
                            <div className="w-0.5 h-full bg-gray-200 mt-1" />
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          <p className="font-medium text-sm">{event.description || event.status}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                            {event.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> {event.location}
                              </span>
                            )}
                            {event.timestamp && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" /> {format(new Date(event.timestamp), 'MMM d, HH:mm')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <p>No tracking history available</p>
                    <p className="text-sm">Click refresh to fetch latest tracking</p>
                  </div>
                )}
              </div>

              {/* Status Message */}
              {selectedShipment.statusMessage && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">{selectedShipment.statusMessage}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Config Modal */}
      <Dialog open={configModalOpen} onOpenChange={setConfigModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add TracxLogis Configuration</DialogTitle>
            <DialogDescription>
              Enter your TracxLogis API credentials.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="configName">Configuration Name</Label>
              <Input
                id="configName"
                placeholder="e.g., Production"
                value={configForm.name}
                onChange={(e) => setConfigForm({ ...configForm, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="apiKey">API Key *</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Your TracxLogis API key"
                value={configForm.apiKey}
                onChange={(e) => setConfigForm({ ...configForm, apiKey: e.target.value })}
              />
              <p className="text-xs text-gray-500">Get this from TracxLogis Developer Portal</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="apiEndpoint">API Endpoint</Label>
              <Input
                id="apiEndpoint"
                placeholder="https://api.tracxlogis.com"
                value={configForm.apiEndpoint}
                onChange={(e) => setConfigForm({ ...configForm, apiEndpoint: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveConfig} disabled={!configForm.apiKey}>
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
