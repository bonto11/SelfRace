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

  return (
    <div className="space-y-4">
      <TrendPareto8020 onPickWeek={handlePick} />

      <ActivityDataProvider days={90}>
        <ActivityTable start={range?.start} end={range?.end} sport={sport} />
      </ActivityDataProvider>
    </div>
  );
}