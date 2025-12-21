// src/app/(protected)/activities/mono/page.tsx
"use client";

import { useCallback, useState } from "react";
import TrendWeeklyMonoStrain from "@/app/features/activities/components/TrendWeeklyMonoStrain";
import ActivityTable from "@/app/features/activities/components/ActivityTable";
import ButtonBack from "@/app/shared/components/ui/ButtonBack";
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
      <ButtonBack title="Monotomy & Strain trend" />

      <div className="max-w-screen-lg mx-auto px-3">
        <div className="mt-3">
          <TrendWeeklyMonoStrain
            onPickWeek={handlePick}
            onSportChange={(s) => setSport(s)}
          />
        </div>

        <div className="mt-3">
          <ActivityTable start={range.start} end={range.end} sport={sport} />
        </div>
      </div>
    </>
  );
}
