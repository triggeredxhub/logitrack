'use client';

import { useState, useEffect } from 'react';
import { DashboardHeader } from '@/components/dashboard-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  AlertTriangle,
  Package,
  Loader2,
  TrendingDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { LowStockAlert } from '@/lib/types';

export default function ReorderAlertsPage() {
  const [alerts, setAlerts] = useState<LowStockAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await fetch('/api/inventory/low-stock');
        const data = await res.json();
        if (data.success) {
          setAlerts(data.data);
        }
      } catch (error) {
        console.error('Error fetching low stock alerts:', error);
        toast.error('Failed to fetch low stock alerts');
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, []);

  const getStockPercentage = (current: number, target: number) => {
    return Math.min(100, Math.max(0, (current / target) * 100));
  };

  const getUrgencyLevel = (deficit: number, reorderLevel: number) => {
    const percentageDeficit = (deficit / reorderLevel) * 100;
    if (percentageDeficit >= 75) return 'critical';
    if (percentageDeficit >= 50) return 'high';
    return 'medium';
  };

  const getUrgencyBadge = (deficit: number, reorderLevel: number) => {
    const level = getUrgencyLevel(deficit, reorderLevel);
    switch (level) {
      case 'critical':
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Critical
          </Badge>
        );
      case 'high':
        return (
          <Badge variant="destructive" className="gap-1 bg-orange-500">
            <TrendingDown className="h-3 w-3" />
            High Priority
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-600">
            <Package className="h-3 w-3" />
            Reorder Soon
          </Badge>
        );
    }
  };

  // Stats
  const criticalCount = alerts.filter(
    (a) => getUrgencyLevel(a.deficit, a.reorderLevel) === 'critical'
  ).length;
  const highCount = alerts.filter(
    (a) => getUrgencyLevel(a.deficit, a.reorderLevel) === 'high'
  ).length;
  const mediumCount = alerts.filter(
    (a) => getUrgencyLevel(a.deficit, a.reorderLevel) === 'medium'
  ).length;

  return (
    <>
      <DashboardHeader title="Reorder Alerts" subtitle="Products that need restocking" />
      <div className="p-6">
        {/* Stats Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-gray-100 p-2">
                <AlertTriangle className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{alerts.length}</p>
                <p className="text-sm text-gray-500">Total Alerts</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border bg-red-50 p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-red-100 p-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
                <p className="text-sm text-red-600">Critical</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border bg-orange-50 p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-orange-100 p-2">
                <TrendingDown className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-600">{highCount}</p>
                <p className="text-sm text-orange-600">High Priority</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border bg-yellow-50 p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-yellow-100 p-2">
                <Package className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">{mediumCount}</p>
                <p className="text-sm text-yellow-600">Reorder Soon</p>
              </div>
            </div>
          </div>
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
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Current Stock</TableHead>
                  <TableHead className="text-right">Reorder Level</TableHead>
                  <TableHead className="text-right">Deficit</TableHead>
                  <TableHead>Stock Level</TableHead>
                  <TableHead>Priority</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <Package className="h-8 w-8 text-green-500" />
                        <p>All products are well-stocked!</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  alerts.map((alert) => {
                    const percentage = getStockPercentage(
                      alert.totalStock,
                      alert.reorderLevel
                    );
                    const urgency = getUrgencyLevel(alert.deficit, alert.reorderLevel);

                    return (
                      <TableRow
                        key={alert.product.id}
                        className={
                          urgency === 'critical'
                            ? 'bg-red-50'
                            : urgency === 'high'
                            ? 'bg-orange-50'
                            : ''
                        }
                      >
                        <TableCell className="font-medium">
                          {alert.product.name}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {alert.product.sku}
                        </TableCell>
                        <TableCell>{alert.product.category || '-'}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {alert.totalStock}
                        </TableCell>
                        <TableCell className="text-right">
                          {alert.reorderLevel}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-red-600">
                          -{alert.deficit}
                        </TableCell>
                        <TableCell>
                          <div className="w-24">
                            <Progress
                              value={percentage}
                              className={
                                urgency === 'critical'
                                  ? '[&>div]:bg-red-500'
                                  : urgency === 'high'
                                  ? '[&>div]:bg-orange-500'
                                  : '[&>div]:bg-yellow-500'
                              }
                            />
                            <p className="mt-1 text-xs text-gray-500">
                              {percentage.toFixed(0)}% of target
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getUrgencyBadge(alert.deficit, alert.reorderLevel)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </>
  );
}
