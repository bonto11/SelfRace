"use client";

import WeeklySummary from "@/features/activity/components/WeeklySummary";
import { THEME } from "@/shared/theme/tokens";

export default function MonoStrainWidget({
  title = "Indexy záťaže",
  weeks,
  metric = "time",
  selectedWeek,
  onOpenDetail,
}: {
  title?: string;
  weeks?: any[];          // ak nepasuje, widget si fetchuje svoje (tvoje pôvodné)
  metric?: "km"|"time"|"trimp";
  selectedWeek?: string | null;
  onOpenDetail?: () => void;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow relative max-w-full overflow-hidden">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <h3 className="text-base font-semibold">{title}</h3>
        <button onClick={onOpenDetail} className="text-xs px-2 py-1 rounded bg-gray-700">
          Detail
        </button>
      </div>

      {/* používam rovnakú kartu s KPI (ACWR, Monotony, Strain) */}
      {selectedWeek &&(
      <WeeklySummary
        weeks={(weeks ?? []) as any}
        metric={metric}
        selectedWeek={selectedWeek}
      />
      )}
    </div>
  );
}
