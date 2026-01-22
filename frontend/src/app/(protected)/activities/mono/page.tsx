// src/app/(protected)/activities/mono/page.tsx
"use client";

import { useCallback, useState } from "react";

import TrendWeeklyMonoStrain from "@/app/features/activities/components/TrendWeeklyMonoStrain";
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
      <AppHeader title="Monotomy & Strain trend" showBack container />

      <div className={PAGE_CONTAINER}>
        <div className={PAGE_STACK}>
          <TrendWeeklyMonoStrain
            onPickWeek={handlePick}
            onSportChange={(s) => setSport(s)}
          />

          <ActivityTable start={range.start} end={range.end} sport={sport} />
        </div>
      </div>
    </>
  );
}