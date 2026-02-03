'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  AlertTriangle,
  Clock,
  BarChart3,
  Activity,
  TrendingUp,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/inventory', label: 'Inventory', icon: Package },
  { href: '/dashboard/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/dashboard/shipments', label: 'Shipments', icon: Truck },
  { href: '/dashboard/reorder-alerts', label: 'Reorder Alerts', icon: AlertTriangle },
  { href: '/dashboard/expiry-tracking', label: 'Expiry Tracking', icon: Clock },
  { href: '/dashboard/monthly-volume', label: 'Monthly Volume', icon: BarChart3 },
  { href: '/dashboard/spike-detection', label: 'Spike Detection', icon: Activity },
  { href: '/dashboard/forecasting', label: 'Forecasting', icon: TrendingUp },
  { href: '/dashboard/data-sync', label: 'Data Sync', icon: RefreshCw },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession() || {};

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-[#1e1e2d] text-white">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5">
          <div className="relative h-10 w-10 overflow-hidden rounded-lg">
            <Image
              src="/logo.png"
              alt="LogiTrack Logo"
              fill
              className="object-cover"
              priority
            />
          </div>
          <div>
            <h1 className="text-lg font-semibold">LogiTrack</h1>
            <p className="text-xs text-gray-400">Logistics Platform</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems?.map((item) => {
            const isActive = pathname === item?.href || 
              (item?.href !== '/dashboard' && pathname?.startsWith(item?.href ?? ''));
            const Icon = item?.icon;
            return (
              <Link
                key={item?.href}
                href={item?.href ?? '#'}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                )}
              >
                {Icon && <Icon className="h-5 w-5" />}
                <span>{item?.label ?? ''}</span>
              </Link>
            );
          }) ?? null}
        </nav>

        {/* User Profile */}
        <div className="border-t border-gray-700 p-4">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-medium">
              {session?.user?.name?.[0]?.toUpperCase() ?? session?.user?.email?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium">
                {session?.user?.name ?? 'User'}
              </p>
              <p className="truncate text-xs text-gray-400">
                {session?.user?.email ?? ''}
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            <LogOut className="h-5 w-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
