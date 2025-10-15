// src/app/(protected)/recovery/ClientPage.tsx
"use client";

import { useRouter } from "next/navigation";
import WidgetRHR from "@/features/widgets/WidgetRHR";
import WidgetHRV from "@/features/widgets/WidgetHRV";
import WidgetSleepDuration from "@/features/widgets/WidgetSleepDuration";
import WidgetSleepStart from "@/features/widgets/WidgetSleepStart";
import InputsCard from "@/features/recovery/components/InputsCard";
import RecoveryDataProvider, { useRecoveryData } from "@/features/recovery/data/RecoveryDataContext";
import { ArrowPathIcon } from "@heroicons/react/24/outline"; // refresh ikona

/* ----------------- Refresh Button ----------------- */
function RefreshButton() {
  const { refresh } = useRecoveryData();

  const onClick = async () => {
    await refresh(true); // force refresh
  };

  return (
    <button
      onClick={onClick}
      title="Obnoviť dáta"
      className="flex items-center gap-1 px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm"
    >
      <ArrowPathIcon className="w-4 h-4" />
      Refresh
    </button>
  );
}

/* ----------------- Hlavná stránka ----------------- */
export default function RecoveryPage() {
  const router = useRouter();

  return (
    <RecoveryDataProvider days={90}>
      <div className="flex items-center justify-end mb-3">
        <RefreshButton />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WidgetRHR onOpenDetail={() => router.push("/recovery/rhr")} />
        <WidgetHRV onOpenDetail={() => router.push("/recovery/hrv")} />
        <WidgetSleepDuration onOpenDetail={() => router.push("/recovery/sleepDuration")} />
        <WidgetSleepStart onOpenDetail={() => router.push("/recovery/sleepStart")} />
        <div className="lg:col-span-2">
          <InputsCard />
        </div>
      </div>
    </RecoveryDataProvider>
  );
}