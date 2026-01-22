"use client";

import { useState, useCallback } from "react";
import { ParetoWeekPick } from "@/app/features/activities/types/pareto";
import TrendPareto8020 from "@/app/features/activities/components/TrendPareto8020";

import ActivityTable from "@/app/features/activities/components/ActivityTable";
import AppHeader from "@/app/shared/components/ui/AppHeader";
import type { Range } from "@/app/features/activities/types/activities";

export default function ParetoPage() {
  const [range, setRange] = useState<Range>({});
  const [sport, setSport] = useState<string>("all");

  const handlePick = useCallback((w: ParetoWeekPick) => {
    setRange({ start: w.start, end: w.end });
    setSport(w.sport || "all");
  }, []);
  return (
    <div className="space-y-4">
    <AppHeader title="80/20 mins" showBack={true} container />

      <TrendPareto8020 onPickWeek={handlePick} />

      <ActivityTable start={range?.start} end={range?.end} sport={sport} />
    </div>
  );
}
