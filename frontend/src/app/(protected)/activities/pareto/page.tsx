// src/app/(protected)/activities/pareto/page.tsx
"use client";

import { useState, useCallback } from "react";

import TrendPareto8020 from "@/app/features/activities/components/TrendPareto8020";
import ActivityTable from "@/app/features/activities/components/ActivityTable";
import AppHeader from "@/app/shared/components/ui/AppHeader";

import { PAGE_CONTAINER, PAGE_STACK } from "@/app/shared/ui/tokens/pageTokens";

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
    <>
      <AppHeader title="80/20 mins" showBack container />

      <div className={PAGE_CONTAINER}>
        <div className={PAGE_STACK}>
          <TrendPareto8020 onPickWeek={handlePick} />
          <ActivityTable start={range.start} end={range.end} sport={sport} />
        </div>
      </div>
    </>
  );
}