// src/app/(protected)/activities/pareto/page.tsx
"use client";

import { useState, useCallback } from "react";
import PageShell from "@/app/shared/components/components/PageShell";

import TrendPareto8020 from "@/app/features/activities/components/TrendPareto8020";
import ActivityTable from "@/app/features/activities/components/ActivityTable";

import type { Range } from "@/app/features/activities/types/activities";
import type { ParetoWeekPick } from "@/app/features/activities/types/pareto";

export default function ParetoPage() {
  const [range, setRange] = useState<Range>({});
  const [sport, setSport] = useState<string>("all");

  const handlePick = useCallback((w: ParetoWeekPick) => {
    setRange({ start: w.start, end: w.end });
    setSport(w.sport || "all");
  }, []);

  return (
    <PageShell title="80/20 mins" showBack>
      <TrendPareto8020 onPickWeek={handlePick} />
      <ActivityTable start={range.start} end={range.end} sport={sport} />
    </PageShell>
  );
}
