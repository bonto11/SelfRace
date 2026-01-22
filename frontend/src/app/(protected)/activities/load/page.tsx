// src/app/(protected)/activities/load/page.tsx
"use client";

import { useCallback, useState } from "react";

import TrendWeeklyLoad from "@/app/features/activities/components/TrendWeeklyLoad";
import ActivityTable from "@/app/features/activities/components/ActivityTable";
import AppHeader from "@/app/shared/components/ui/AppHeader";

import { PAGE_CONTAINER, PAGE_STACK } from "@/app/shared/ui/tokens/pageTokens";

import type { WeekPick, Range } from "@/app/features/activities/types/activities";

export default function Page() {
  const [range, setRange] = useState<Range>({});
  const [sport, setSport] = useState<string>("all");

  const handlePick = useCallback((w: WeekPick) => {
    setRange({ start: w.start, end: w.end });
    setSport(w.sport || "all");
  }, []);

  return (
    <>
      <AppHeader title="Weekly load trend" showBack container />

      <div className={PAGE_CONTAINER}>
        <div className={PAGE_STACK}>
          <TrendWeeklyLoad
            onPickWeek={handlePick}
            onSportChange={(s) => setSport(s)}
          />

          <ActivityTable start={range.start} end={range.end} sport={sport} />
        </div>
      </div>
    </>
  );
}