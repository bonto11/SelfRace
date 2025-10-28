"use client";

import { useState, useCallback } from "react";
import TrendPareto8020, { ParetoWeekPick } from "@/features/activity/components/TrendPareto8020";
import ActivityTable from "@/features/activity/components/ActivityTable";
import { ActivityDataProvider } from "@/features/activity/data/ActivityDataProvider";

export default function ParetoPage() {
  const [range, setRange] = useState<{ start?: string; end?: string } | null>(null);
  const [sport, setSport] = useState<string>("all");

  const handlePick = useCallback((w: ParetoWeekPick) => {
    console.debug("[PARETO][page] onPickWeek <-", w);
    setRange({ start: w.start, end: w.end });
    setSport(w.sport || "all");
  }, []);

  const handleBack = useCallback(() => {
    setRange(null);
    setSport("all");
  }, []);

  const hasRange = !!range?.start && !!range?.end;

  return (
    <div className="space-y-4">
      {!hasRange && <TrendPareto8020 onPickWeek={handlePick} />}

      <ActivityDataProvider days={90}>
        {hasRange ? (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold opacity-85">Vybraný týždeň</h2>
              <button
                onClick={handleBack}
                className="px-3 py-1 text-sm rounded bg-gray-700 hover:bg-gray-600 text-white"
              >
                ← Späť
              </button>
            </div>

            <ActivityTable start={range?.start} end={range?.end} sport={sport} />
          </div>
        ) : (
          <div className="opacity-75 text-sm">
            <p>Klikni na bod v grafe pre zobrazenie detailov aktivít daného týždňa.</p>
          </div>
        )}
      </ActivityDataProvider>
    </div>
  );
}