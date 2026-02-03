import { DashboardHeader } from '@/components/dashboard-header';
import { TrendingUp } from 'lucide-react';

export default function ForecastingPage() {
  return (
    <>
      <DashboardHeader title="Forecasting" subtitle="Predict future inventory needs" />
      <div className="p-8">
        <div className="flex flex-col items-center justify-center rounded-xl bg-white p-12 shadow-sm">
          <div className="rounded-full bg-teal-50 p-4">
            <TrendingUp className="h-12 w-12 text-teal-600" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900">Forecasting</h3>
          <p className="mt-2 text-center text-sm text-gray-500">
            AI-powered demand forecasting.<br />
            Features to be implemented in next milestone.
          </p>
        </div>
      </div>
    </>
  );
}
