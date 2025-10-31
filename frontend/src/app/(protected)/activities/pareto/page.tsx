"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import TrendPareto8020, {
  ParetoWeekPick,
} from "@/features/activity/components/TrendPareto8020";
import ActivityTable from "@/shared/components/ActivityTable";
import { ActivityDataProvider } from "@/shared/components/dataProviders/ActivityDataProvider";

export default function ParetoPage() {
  const [range, setRange] = useState<{ start?: string; end?: string } | null>(
    null
  );
  const [sport, setSport] = useState<string>("all");

  const handlePick = useCallback((w: ParetoWeekPick) => {
    console.debug("[PARETO][page] onPickWeek <-", w);
    setRange({ start: w.start, end: w.end });
    setSport(w.sport || "all");
  }, []);

  return (
    <div className="space-y-4">
      {/* horný panel s tlačidlom späť */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Trend 80/20</h1>
        <Link
          href="/activities"
          className="px-3 py-1.5 text-sm rounded bg-gray-700 hover:bg-gray-600 text-white"
        >
          ← Späť na aktivity
        </Link>
      </div>

      {/* trend je vždy zobrazený */}
      <TrendPareto8020 onPickWeek={handlePick} />

      {/* tabuľka je pod trendom; keď nie je vybraný týždeň, zobrazí prázdny stav */}
      <ActivityDataProvider days={90}>
        <ActivityTable
          start={range?.start}
          end={range?.end}
          sport={sport}
          // allowedSports môžeš pridať ak chceš whitelistiť pre pareto (napr. ["run","ride","mixed","skate"])
        />
        {!range?.start && (
          <div className="text-xs opacity-70 mt-1">
            Tip: klikni na bod v grafe, zobrazí sa detail týždňa nižšie.
          </div>
        )}
      </ActivityDataProvider>
    </div>
  );
}
