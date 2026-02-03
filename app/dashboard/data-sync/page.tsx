'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
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
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  RefreshCw,
  Plus,
  Store,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Trash2,
  ExternalLink,
  Clock,
  History,
} from 'lucide-react';
import { toast } from 'sonner';

interface ShopeeConfig {
  id: string;
  shopId: string;
  shopName: string | null;
  partnerId: string;
  isActive: boolean;
  isTokenValid: boolean;
  tokenExpiresAt: string | null;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SyncLog {
  id: string;
  syncType: string;
  status: string;
  ordersImported: number;
  ordersSkipped: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

export default function DataSyncPage() {
  const searchParams = useSearchParams();
  const [configs, setConfigs] = useState<ShopeeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  // Add config modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    shopId: '',
    partnerId: '',
    partnerKey: '',
    shopName: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // History modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<ShopeeConfig | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await fetch('/api/shopee');
      const data = await res.json();
      if (data.success) {
        setConfigs(data.data);
      }
    } catch (error) {
      console.error('Error fetching configs:', error);
      toast.error('Failed to fetch Shopee configurations');
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchConfigs();
      setLoading(false);
    };
    loadData();
  }, [fetchConfigs]);

  // Handle URL params for OAuth callback
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success === 'authorized') {
      toast.success('Successfully connected to Shopee!');
      fetchConfigs();
    } else if (error) {
      const message = searchParams.get('message') || error;
      toast.error(`Shopee authorization failed: ${message}`);
    }
  }, [searchParams, fetchConfigs]);

  const handleAddConfig = async () => {
    if (!addForm.shopId || !addForm.partnerId || !addForm.partnerKey) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      // First, test the credentials before saving
      const testRes = await fetch('/api/shopee/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerId: addForm.partnerId,
          partnerKey: addForm.partnerKey,
        }),
      });

      const testData = await testRes.json();
      if (!testData.success) {
        toast.error(testData.error || 'Invalid credentials. Please check your Partner ID and Partner Key.');
        setSubmitting(false);
        return;
      }

      // Credentials valid, now create the config
      const res = await fetch('/api/shopee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Configuration created! Opening Shopee for authorization...');
        setAddModalOpen(false);
        setAddForm({ shopId: '', partnerId: '', partnerKey: '', shopName: '' });
        await fetchConfigs();
        // Open Shopee auth URL in new tab so user doesn't lose context
        if (data.authUrl) {
          window.open(data.authUrl, '_blank');
        }
      } else {
        toast.error(data.error || 'Failed to create configuration');
      }
    } catch (error) {
      console.error('Error creating config:', error);
      toast.error('Failed to create configuration');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReauthorize = async (config: ShopeeConfig) => {
    try {
      const res = await fetch(`/api/shopee/${config.id}`, { method: 'POST' });
      const data = await res.json();
      if (data.success && data.authUrl) {
        // Open in new tab so user doesn't lose context
        window.open(data.authUrl, '_blank');
        toast.info('Authorization page opened in new tab');
      } else {
        toast.error(data.error || 'Failed to generate authorization URL');
      }
    } catch (error) {
      console.error('Error reauthorizing:', error);
      toast.error('Failed to reauthorize');
    }
  };

  const handleSync = async (config: ShopeeConfig) => {
    if (!config.isTokenValid) {
      toast.error('Please authorize with Shopee first');
      return;
    }

    setSyncing(config.id);
    try {
      const res = await fetch('/api/shopee/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configId: config.id, daysBack: 7 }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchConfigs();
      } else {
        toast.error(data.error || 'Sync failed');
      }
    } catch (error) {
      console.error('Error syncing:', error);
      toast.error('Failed to sync orders');
    } finally {
      setSyncing(null);
    }
  };

  const handleDelete = async (config: ShopeeConfig) => {
    if (!confirm('Are you sure you want to delete this configuration?')) {
      return;
    }

    try {
      const res = await fetch(`/api/shopee/${config.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Configuration deleted');
        fetchConfigs();
      } else {
        toast.error(data.error || 'Failed to delete');
      }
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Failed to delete configuration');
    }
  };

  const viewHistory = async (config: ShopeeConfig) => {
    setSelectedConfig(config);
    setHistoryModalOpen(true);
    setHistoryLoading(true);

    try {
      const res = await fetch(`/api/shopee/sync?configId=${config.id}`);
      const data = await res.json();
      if (data.success) {
        setSyncHistory(data.data);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
      toast.error('Failed to fetch sync history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'started':
        return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <>
      <DashboardHeader title="Data Sync" subtitle="Synchronize with Shopee" />
      <div className="p-6">
        {/* Info Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Shopee Integration
            </CardTitle>
            <CardDescription>
              Connect your Shopee shop to automatically import orders. Orders are imported read-only - 
              inventory is NOT automatically deducted.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm">
              <h4 className="font-semibold text-blue-800 mb-2">📋 Before Connecting</h4>
              <ol className="list-decimal list-inside space-y-1 text-blue-700">
                <li>Go to <a href="https://open.shopee.com" target="_blank" rel="noopener noreferrer" className="underline">Shopee Open Platform</a> → Your App</li>
                <li>Copy your <strong>Partner ID</strong> (App ID) and <strong>Partner Key</strong></li>
                <li>Get your <strong>Shop ID</strong> from Shopee Seller Center → Settings</li>
                <li>Add this app&apos;s domain to <strong>Redirect URL Domain</strong> in Shopee</li>
                <li>If IP Whitelist is enabled, add the deployment server IP</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Toolbar */}
        <div className="mb-6 flex justify-between items-center">
          <h3 className="text-lg font-semibold">Connected Shops</h3>
          <Button onClick={() => setAddModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Connect Shop
          </Button>
        </div>

        {/* Configs List */}
        <div className="rounded-lg border bg-white shadow-sm">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : configs.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center text-gray-500">
              <Store className="h-8 w-8 mb-2" />
              <p>No Shopee shops connected yet.</p>
              <p className="text-sm">Click &quot;Connect Shop&quot; to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shop</TableHead>
                  <TableHead>Shop ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Sync</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell className="font-medium">
                      {config.shopName || `Shop ${config.shopId}`}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{config.shopId}</TableCell>
                    <TableCell>
                      {config.isTokenValid ? (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Connected
                        </Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-800">
                          <AlertCircle className="mr-1 h-3 w-3" />
                          Authorization Required
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {config.lastSyncAt ? (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(config.lastSyncAt).toLocaleString()}
                        </span>
                      ) : (
                        'Never'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {config.isTokenValid ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSync(config)}
                            disabled={syncing === config.id}
                          >
                            {syncing === config.id ? (
                              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="mr-1 h-4 w-4" />
                            )}
                            Sync
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReauthorize(config)}
                          >
                            <ExternalLink className="mr-1 h-4 w-4" />
                            Authorize
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => viewHistory(config)}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(config)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Important Notice */}
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-800">Important: Read-Only Import</h4>
              <p className="text-sm text-amber-700 mt-1">
                Shopee orders are imported read-only. Inventory is NOT automatically deducted 
                when orders are synced. This is intentional to prevent accidental stock discrepancies. 
                Use the Orders page to manually link inventory batches if needed.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Config Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Shopee Shop</DialogTitle>
            <DialogDescription>
              Enter your Shopee Open Platform credentials to connect your shop.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="partnerId">Partner ID (App ID) *</Label>
              <Input
                id="partnerId"
                placeholder="e.g., 2007123"
                value={addForm.partnerId}
                onChange={(e) => setAddForm({ ...addForm, partnerId: e.target.value })}
              />
              <p className="text-xs text-gray-500">Found in Shopee Open Platform → App List → Your App</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="partnerKey">Partner Key *</Label>
              <Input
                id="partnerKey"
                type="password"
                placeholder="Your secret partner key"
                value={addForm.partnerKey}
                onChange={(e) => setAddForm({ ...addForm, partnerKey: e.target.value })}
              />
              <p className="text-xs text-gray-500">Secret key from Shopee Open Platform (keep confidential)</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="shopId">Shop ID *</Label>
              <Input
                id="shopId"
                placeholder="e.g., 123456789"
                value={addForm.shopId}
                onChange={(e) => setAddForm({ ...addForm, shopId: e.target.value })}
              />
              <p className="text-xs text-gray-500">Your shop&apos;s numeric ID from Shopee Seller Center</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="shopName">Shop Name (optional)</Label>
              <Input
                id="shopName"
                placeholder="e.g., Nano SG"
                value={addForm.shopName}
                onChange={(e) => setAddForm({ ...addForm, shopName: e.target.value })}
              />
              <p className="text-xs text-gray-500">Display name for this connection</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddConfig} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Connect & Authorize
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sync History Modal */}
      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Sync History - {selectedConfig?.shopName || `Shop ${selectedConfig?.shopId}`}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {historyLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : syncHistory.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center text-gray-500">
                <History className="h-8 w-8 mb-2" />
                <p>No sync history yet.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Imported</TableHead>
                    <TableHead>Skipped</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncHistory.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {new Date(log.startedAt).toLocaleString()}
                      </TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell>{log.ordersImported}</TableCell>
                      <TableCell>{log.ordersSkipped}</TableCell>
                      <TableCell className="text-sm text-red-600 max-w-[200px] truncate">
                        {log.errorMessage || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
