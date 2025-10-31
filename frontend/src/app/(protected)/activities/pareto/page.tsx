"use client";

import { useState, useCallback } from "react";
import TrendPareto8020, { ParetoWeekPick } from "@/features/activity/components/TrendPareto8020";
import ActivityTable from "@/shared/components/ActivityTable";
import { ActivityDataProvider } from "@/shared/components/dataProviders/ActivityDataProvider";
import ButtonBack from "@/shared/components/ui/ButtonBack";

export default function ParetoPage() {
  const [range, setRange] = useState<{ start?: string; end?: string } | null>(null);
  const [sport, setSport] = useState<string>("all");

  const handlePick = useCallback((w: ParetoWeekPick) => {
    console.debug("[PARETO][page] onPickWeek <-", w);
    setRange({ start: w.start, end: w.end });
    setSport(w.sport || "all");
  }, []);

  return (
    <div className="space-y-4">
      <ButtonBack
        title="Trend 80/20"
        href="/activities"
        label="Späť na aktivity"
        className="mx-0 px-0"
        container={false}
      />

      <TrendPareto8020 onPickWeek={handlePick} />

      <ActivityDataProvider days={90}>
        <ActivityTable start={range?.start} end={range?.end} sport={sport} />
        {!range?.start && (
          <div className="text-xs opacity-70 mt-1">
            Tip: klikni na bod v grafe, zobrazí sa detail týždňa nižšie.
          </div>
        )}
      </ActivityDataProvider>
    </div>
  );
}