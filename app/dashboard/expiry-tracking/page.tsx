'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardHeader } from '@/components/dashboard-header';
import { Button } from '@/components/ui/button';
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
  Calendar,
  AlertTriangle,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

interface ExpiryBatch {
  id: string;
  productId: string;
  batchNumber: string;
  quantity: number;
  expiryDate: string | null;
  isExpired: boolean;
  location: string | null;
  product: {
    name: string;
    sku: string;
  };
  daysUntilExpiry: number | null;
  isExpiringSoon: boolean;
  daysExpired?: number | null;
}

type ViewFilter = 'all' | 'expired' | 'expiring_soon';

export default function ExpiryTrackingPage() {
  const [batches, setBatches] = useState<ExpiryBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ViewFilter>('all');
  const [flagging, setFlagging] = useState(false);

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/inventory';
      if (filter === 'expired') {
        url = '/api/inventory/expired';
      } else if (filter === 'expiring_soon') {
        url = '/api/inventory?expiringSoon=true';
      }

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setBatches(data.data);
      }
    } catch (error) {
      console.error('Error fetching batches:', error);
      toast.error('Failed to fetch batches');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  const handleFlagExpired = async () => {
    setFlagging(true);
    try {
      const res = await fetch('/api/cron/flag-expired', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchBatches();
      } else {
        toast.error(data.error || 'Failed to flag expired batches');
      }
    } catch (error) {
      console.error('Error flagging expired batches:', error);
      toast.error('Failed to flag expired batches');
    } finally {
      setFlagging(false);
    }
  };

  const getExpiryStatus = (batch: ExpiryBatch) => {
    if (batch.isExpired || (batch.daysUntilExpiry !== null && batch.daysUntilExpiry < 0)) {
      return 'expired';
    }
    if (batch.daysUntilExpiry !== null && batch.daysUntilExpiry <= 7) {
      return 'critical';
    }
    if (batch.daysUntilExpiry !== null && batch.daysUntilExpiry <= 30) {
      return 'warning';
    }
    return 'ok';
  };

  const getExpiryBadge = (batch: ExpiryBatch) => {
    const status = getExpiryStatus(batch);
    switch (status) {
      case 'expired':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Expired
          </Badge>
        );
      case 'critical':
        return (
          <Badge variant="destructive" className="gap-1 bg-orange-500">
            <AlertTriangle className="h-3 w-3" />
            {batch.daysUntilExpiry} days left
          </Badge>
        );
      case 'warning':
        return (
          <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-600">
            <Clock className="h-3 w-3" />
            {batch.daysUntilExpiry} days left
          </Badge>
        );
      default:
        return batch.expiryDate ? (
          <Badge variant="secondary" className="gap-1">
            <Calendar className="h-3 w-3" />
            {batch.daysUntilExpiry} days left
          </Badge>
        ) : (
          <Badge variant="outline">No expiry</Badge>
        );
    }
  };

  // Stats
  const expiredCount = batches.filter(
    (b) => b.isExpired || (b.daysUntilExpiry !== null && b.daysUntilExpiry < 0)
  ).length;
  const criticalCount = batches.filter(
    (b) => !b.isExpired && b.daysUntilExpiry !== null && b.daysUntilExpiry >= 0 && b.daysUntilExpiry <= 7
  ).length;
  const warningCount = batches.filter(
    (b) => !b.isExpired && b.daysUntilExpiry !== null && b.daysUntilExpiry > 7 && b.daysUntilExpiry <= 30
  ).length;

  return (
    <>
      <DashboardHeader title="Expiry Tracking" subtitle="Monitor product expiration dates" />
      <div className="p-6">
        {/* Stats Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border bg-red-50 p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-red-100 p-2">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{expiredCount}</p>
                <p className="text-sm text-red-600">Expired Batches</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border bg-orange-50 p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-orange-100 p-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-600">{criticalCount}</p>
                <p className="text-sm text-orange-600">Expiring This Week</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border bg-yellow-50 p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-yellow-100 p-2">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">{warningCount}</p>
                <p className="text-sm text-yellow-600">Expiring This Month</p>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
              size="sm"
            >
              All Batches
            </Button>
            <Button
              variant={filter === 'expired' ? 'default' : 'outline'}
              onClick={() => setFilter('expired')}
              size="sm"
            >
              <XCircle className="mr-1 h-4 w-4" />
              Expired
            </Button>
            <Button
              variant={filter === 'expiring_soon' ? 'default' : 'outline'}
              onClick={() => setFilter('expiring_soon')}
              size="sm"
            >
              <AlertTriangle className="mr-1 h-4 w-4" />
              Expiring Soon
            </Button>
          </div>
          <Button
            variant="outline"
            onClick={handleFlagExpired}
            disabled={flagging}
          >
            {flagging ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Flag Expired Batches
          </Button>
        </div>

        {/* Table */}
        <div className="rounded-lg border bg-white shadow-sm">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Batch #</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-gray-500">
                      {filter === 'expired'
                        ? 'No expired batches found.'
                        : filter === 'expiring_soon'
                        ? 'No batches expiring within 30 days.'
                        : 'No inventory batches found.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  batches.map((batch) => (
                    <TableRow
                      key={batch.id}
                      className={
                        getExpiryStatus(batch) === 'expired'
                          ? 'bg-red-50'
                          : getExpiryStatus(batch) === 'critical'
                          ? 'bg-orange-50'
                          : ''
                      }
                    >
                      <TableCell className="font-medium">{batch.product.name}</TableCell>
                      <TableCell className="font-mono text-sm">{batch.product.sku}</TableCell>
                      <TableCell className="font-mono text-sm">{batch.batchNumber}</TableCell>
                      <TableCell className="text-right">{batch.quantity}</TableCell>
                      <TableCell>
                        {batch.expiryDate
                          ? new Date(batch.expiryDate).toLocaleDateString()
                          : '-'}
                      </TableCell>
                      <TableCell>{batch.location || '-'}</TableCell>
                      <TableCell>{getExpiryBadge(batch)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </>
  );
}
