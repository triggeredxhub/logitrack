import { DashboardHeader } from '@/components/dashboard-header';
import { BarChart3 } from 'lucide-react';

export default function MonthlyVolumePage() {
  return (
    <>
      <DashboardHeader title="Monthly Volume" subtitle="Analyze monthly order volumes" />
      <div className="p-8">
        <div className="flex flex-col items-center justify-center rounded-xl bg-white p-12 shadow-sm">
          <div className="rounded-full bg-blue-50 p-4">
            <BarChart3 className="h-12 w-12 text-blue-600" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900">Monthly Volume</h3>
          <p className="mt-2 text-center text-sm text-gray-500">
            Charts and analytics for monthly order volumes.<br />
            Features to be implemented in next milestone.
          </p>
        </div>
      </div>
    </>
  );
}
