
// src/app/recovery/page.tsx (alebo kde máš klientsku stránku)
"use client";
import { useRouter } from "next/navigation";
import WidgetRHR from "@/features/widgets/WidgetRHR";
import WidgetHRV from "@/features/widgets/WidgetHRV";
import WidgetSleepDuration from "@/features/widgets/WidgetSleepDuration";
import WidgetSleepStart from "@/features/widgets/WidgetSleepStart";
import InputsCard  from "@/features/recovery/components/InputsCard";
import { useState } from "react";

export default function RecoveryPage() {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [spinning, setSpinning] = useState(false);

  function triggerRefresh() {
    setSpinning(true);
    setRefreshKey(k => k + 1);
    // malá animácia ikony
    setTimeout(() => setSpinning(false), 600);
  }

  return (
    <>
    {/* HEADER s refreshom */}
    
      <div className="flex items-center justify-end mb-3">
        <button
          onClick={triggerRefresh}
          aria-label="Refresh"
          title="Refresh"
          className="inline-flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 px-2 py-1"
        >
          {/* jednoduché inline SVG (arrow-path ikonka) */}
          <svg
            viewBox="0 0 24 24"
            className={`h-5 w-5 ${spinning ? "animate-spin" : ""}`}
            fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-3-6.7" />
            <path d="M21 3v6h-6" />
          </svg>
        </button>
      </div>

    {/* GRID s widgetmi */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
      <WidgetRHR onOpenDetail={() => router.push("/recovery/rhr")} />
      <WidgetHRV onOpenDetail={() => router.push("/recovery/hrv")} />
      <WidgetSleepDuration onOpenDetail={() => router.push("/recovery/sleepDuration")} />
      <WidgetSleepStart onOpenDetail={() => router.push("/recovery/sleepStart")} />
      <div className="col-span-1 lg:col-span-2">
        <InputsCard />  
      </div>
    </div>
    </>
  );
}
