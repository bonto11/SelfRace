// src/app/(protected)/recovery/page.tsx (alebo tvoja ClientPage)
"use client";

import WidgetRHR from "@/features/widgets/RHR";
import WidgetHRV from "@/features/widgets/HRV";
import WidgetSleepDuration from "@/features/widgets/SleepDuration";
import WidgetSleepStart from "@/features/widgets/SleepStart";
// (pôvodné Trend* komponenty si nechaj na detail view)

export default function ClientPage() {
  return (
    <div>
      {/* 4 malé widgety */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <WidgetRHR />
        <WidgetHRV />
        <WidgetSleepDuration />
        <WidgetSleepStart />
      </div>

      {/* sem neskôr pridáme prekliky na full-screen trendy */}
    </div>
  );
}
