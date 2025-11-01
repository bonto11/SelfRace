"use client";

import { useRouter } from "next/navigation";
import {
  useRecoveryData,
  RecoveryDataProvider,
} from "@/shared/components/dataProviders/RecoveryDataProvider";

import WidgetRHR from "@/features/widgets/WidgetRHR";
import WidgetHRV from "@/features/widgets/WidgetHRV";
import WidgetSleepDuration from "@/features/widgets/WidgetSleepDuration";
import WidgetSleepStart from "@/features/widgets/WidgetSleepStart";
import InputsCard from "@/features/recovery/components/InputsCard";
import { toast } from "@/shared/components/ui/Toast";

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
      <svg
        className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M4 4v6h6" />
        <path d="M20 20v-6h-6" />
        <path d="M5 15a7 7 0 0 0 12 2M19 9a7 7 0 0 0-12-2" />
      </svg>
      {loading ? "Refreshing…" : "Refresh"}
    </button>
  );
}

export default function RecoveryPage() {
  const router = useRouter();
  console.debug("[REC][UI] RecoveryPage mount");

  return (
    <RecoveryDataProvider days={90}>
      <div className="mt-6">
        <InputsCard />
      </div>

      <div className="flex items-center justify-end mb-3">
        <RefreshButton />
      </div>
     
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WidgetRHR onOpenDetail={() => router.push("/recovery/rhr")} />
        <WidgetHRV onOpenDetail={() => router.push("/recovery/hrv")} />
        <WidgetSleepDuration
          onOpenDetail={() => router.push("/recovery/sleepDuration")}
        />
        <WidgetSleepStart
          onOpenDetail={() => router.push("/recovery/sleepStart")}
        />
      </div>
    </RecoveryDataProvider>
  );
}
