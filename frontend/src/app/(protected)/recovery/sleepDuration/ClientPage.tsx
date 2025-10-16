'use client';

import dynamic from 'next/dynamic';
import { RecoveryDataProvider } from '@/features/recovery/data/RecoveryDataContext';

// dynamický import komponentu s grafom
const SleepDurationDetailClient = dynamic(
  () => import('@/features/recovery/components/DetailSleepDuration'),
  { ssr: false }
);

export default function Page() {
  return (
    <RecoveryDataProvider days={90}>
      <div className="p-4">
        <SleepDurationDetailClient />
      </div>
    </RecoveryDataProvider>
  );
}


