// src/app/(protected)/recovery/ClientPage.tsx
"use client";

import { useRouter } from "next/navigation";
import WidgetRHR from "@/features/widgets/WidgetRHR";
import WidgetHRV from "@/features/widgets/WidgetHRV";
import WidgetSleepDuration from "@/features/widgets/WidgetSleepDuration";
import WidgetSleepStart from "@/features/widgets/WidgetSleepStart";
import InputsCard from "@/features/recovery/components/InputsCard";
import {
  RecoveryDataProvider,
  useRecoveryData,
} from "@/features/recovery/data/RecoveryDataContext";

// Malé refresh tlačidlo s inline SVG (bez @heroicons/react)
function RefreshButton() {
  const { refresh, loading } = useRecoveryData();

  return (
    <button
      type="button"
      onClick={() => refresh(true)}
      className="inline-flex items-center gap-2 rounded bg-gray-700 px-3 py-1.5 text-sm hover:bg-gray-600"
      title="Obnoviť dáta"
      disabled={loading}
    >
      <svg
        className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M21 12a9 9 0 1 1-3-6.7" />
        <path d="M21 3v6h-6" />
      </svg>
      <span>{loading ? "Obnovujem…" : "Refresh"}</span>
    </button>
  );
}

export default function RecoveryPage() {
  const router = useRouter();

  return (
    // cache & fetch pre recovery (90 dní; widgety/detail si zoberú koľko potrebujú)
    <RecoveryDataProvider days={90}>
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

        {/* InputsCard na celú šírku na lg+ */}
        <div className="lg:col-span-2">
          <InputsCard />
        </div>
      </div>
    </RecoveryDataProvider>
  );
}