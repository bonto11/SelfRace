// src/app/(protected)/activities/mono/page.tsx
"use client";

import { useCallback, useState } from "react";
import PageShell from "@/app/shared/ui/components/PageShell";

import TrendWeeklyMonoStrain from "@/app/features/activities/components/TrendWeeklyMonoStrain";
import ActivityTable from "@/app/features/activities/components/ActivityTable";

import type {
  WeekPick,
  Range,
} from "@/app/features/activities/types/activities";

export default function Page() {
  const [range, setRange] = useState<Range>({});
  const [sport, setSport] = useState<string>("all");

  const handlePick = useCallback((w: WeekPick) => {
    setRange({ start: w.start, end: w.end });
    setSport(w.sport || "all");
  }, []);

  return (
    <PageShell title="Týždňová monotónnosť a úsilie" showBack showPoweredByStrava>
      <TrendWeeklyMonoStrain
        onPickWeek={handlePick}
        onSportChange={(s) => setSport(s)}
      />
      <ActivityTable start={range.start} end={range.end} sport={sport} />
    </PageShell>
  );
}
