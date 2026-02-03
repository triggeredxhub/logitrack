import { DashboardHeader } from '@/components/dashboard-header';
import { Package, ShoppingCart, Truck, DollarSign, AlertTriangle, Clock, Activity } from 'lucide-react';

const stats = [
  { label: 'Total Products', value: '0', icon: Package, color: 'bg-blue-50 text-blue-600' },
  { label: 'Total Orders', value: '0', icon: ShoppingCart, color: 'bg-purple-50 text-purple-600' },
  { label: 'Active Shipments', value: '0', icon: Truck, color: 'bg-green-50 text-green-600' },
  { label: 'Monthly Revenue', value: '$0', icon: DollarSign, color: 'bg-yellow-50 text-yellow-600' },
];

const alerts = [
  { label: 'Low Stock Alerts', value: '0', icon: AlertTriangle, color: 'bg-orange-50 text-orange-600' },
  { label: 'Expiring Soon', value: '0', icon: Clock, color: 'bg-red-50 text-red-600' },
  { label: 'Volume Spikes', value: '0', icon: Activity, color: 'bg-indigo-50 text-indigo-600' },
];

export default function DashboardPage() {
  return (
    <>
      <DashboardHeader title="Dashboard" subtitle="Overview of your logistics operations" />
      <div className="p-8">
        {/* Stats Grid */}
        <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stats?.map((stat) => {
            const Icon = stat?.icon;
            return (
              <div
                key={stat?.label}
                className="rounded-xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{stat?.label ?? ''}</p>
                    <p className="mt-1 text-2xl font-semibold text-gray-900">{stat?.value ?? '0'}</p>
                  </div>
                  <div className={`rounded-lg p-3 ${stat?.color ?? ''}`}>
                    {Icon && <Icon className="h-6 w-6" />}
                  </div>
                </div>
              </div>
            );
          }) ?? null}
        </div>

        {/* Alerts Grid */}
        <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {alerts?.map((alert) => {
            const Icon = alert?.icon;
            return (
              <div
                key={alert?.label}
                className="rounded-xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-center gap-4">
                  <div className={`rounded-lg p-3 ${alert?.color ?? ''}`}>
                    {Icon && <Icon className="h-6 w-6" />}
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-gray-900">{alert?.value ?? '0'}</p>
                    <p className="text-sm text-gray-500">{alert?.label ?? ''}</p>
                  </div>
                </div>
              </div>
            );
          }) ?? null}
        </div>

        {/* Placeholder Charts */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Monthly Order Volume</h3>
            <div className="flex h-64 items-center justify-center rounded-lg bg-gray-50 text-gray-400">
              Chart placeholder - to be implemented
            </div>
          </div>
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Orders by Channel</h3>
            <div className="flex h-64 items-center justify-center rounded-lg bg-gray-50 text-gray-400">
              Chart placeholder - to be implemented
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
