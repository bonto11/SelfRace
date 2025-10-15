'use client';

import { useRouter } from 'next/navigation';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import RecoveryDataProvider, { useRecoveryData } from '@/features/recovery/data/RecoveryDataContext';

import WidgetRHR from '@/features/widgets/WidgetRHR';
import WidgetHRV from '@/features/widgets/WidgetHRV';
import WidgetSleepDuration from '@/features/widgets/WidgetSleepDuration';
import WidgetSleepStart from '@/features/widgets/WidgetSleepStart';
import InputsCard from '@/features/recovery/components/InputsCard';

function RefreshButton() {
  const { refresh, loading } = useRecoveryData();
  const onClick = async () => {
    await refresh(true);
  };
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-sm disabled:opacity-60"
      title="Refresh data"
    >
      <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      Refresh
    </button>
  );
}

export default function RecoveryPage() {
  const router = useRouter();

  return (
    <RecoveryDataProvider days={90}>
      <div className="flex items-center justify-end mb-3">
        <RefreshButton />
      </div>

      {/* Widgets (môžeš odstrániť, ak chceš mať len InputsCard) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WidgetRHR onOpenDetail={() => router.push('/recovery/rhr')} />
        <WidgetHRV onOpenDetail={() => router.push('/recovery/hrv')} />
        <WidgetSleepDuration onOpenDetail={() => router.push('/recovery/sleepDuration')} />
        <WidgetSleepStart onOpenDetail={() => router.push('/recovery/sleepStart')} />
      </div>

      {/* Inputs card – na desktope plná šírka, na menších pod sebou */}
      <div className="mt-6">
        <InputsCard />
      </div>
    </RecoveryDataProvider>
  );
}