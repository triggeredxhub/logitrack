import { DashboardHeader } from '@/components/dashboard-header';
import { Activity } from 'lucide-react';

export default function SpikeDetectionPage() {
  return (
    <>
      <DashboardHeader title="Spike Detection" subtitle="Detect unusual order patterns" />
      <div className="p-8">
        <div className="flex flex-col items-center justify-center rounded-xl bg-white p-12 shadow-sm">
          <div className="rounded-full bg-indigo-50 p-4">
            <Activity className="h-12 w-12 text-indigo-600" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900">Spike Detection</h3>
          <p className="mt-2 text-center text-sm text-gray-500">
            Automated detection of order volume spikes.<br />
            Features to be implemented in next milestone.
          </p>
        </div>
      </div>
    </>
  );
}
