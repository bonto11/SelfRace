"use client";

import { useState, useCallback } from "react";
import { ParetoWeekPick } from "@/features/activities/types/pareto";
import TrendPareto8020 from "@/features/activities/components/TrendPareto8020";

import ActivityTable from "@/features/activities/components/ActivityTable";
import ButtonBack from "@/shared/components/ui/ButtonBack";
import type { Range } from "@/features/activities/types/activities";

export default function ParetoPage() {
  const [range, setRange] = useState<Range>({});
  const [sport, setSport] = useState<string>("all");

  const handlePick = useCallback((w: ParetoWeekPick) => {
    setRange({ start: w.start, end: w.end });
    setSport(w.sport || "all");
  }, []);
  return (
    <div className="space-y-4">
      <ButtonBack title="80/20 trend" />

      <TrendPareto8020 onPickWeek={handlePick} />

      <ActivityTable start={range?.start} end={range?.end} sport={sport} />
    </div>
  );
}
