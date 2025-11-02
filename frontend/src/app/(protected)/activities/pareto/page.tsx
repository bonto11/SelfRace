"use client";

import { useState, useCallback } from "react";
import TrendPareto8020, {
  ParetoWeekPick,
} from "@/features/activity/components/TrendPareto8020";
import ActivityTable from "@/shared/components/ActivityTable";
import ButtonBack from "@/shared/components/ui/ButtonBack";

export default function ParetoPage() {
  const [range, setRange] = useState<{ start?: string; end?: string } | null>(
    null
  );
  const [sport, setSport] = useState<string>("all");

  const handlePick = useCallback((w: ParetoWeekPick) => {
    setRange({ start: w.start, end: w.end });
    setSport(w.sport || "all");
  }, []);

  return (
    <div className="space-y-4">
      <ButtonBack title="Trend 80/20" />

      <TrendPareto8020 onPickWeek={handlePick} />

      <ActivityTable start={range?.start} end={range?.end} sport={sport} />
    </div>
  );
}
