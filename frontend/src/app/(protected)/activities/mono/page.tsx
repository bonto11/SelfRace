// src/app/(protected)/activities/detail/page.tsx
"use client";

import { useCallback, useState } from "react";
import TrendWeeklyMonoStrain from "@/features/activity/components/TrendWeeklyMonoStrain";
import ActivityTable from "@/shared/components/ActivityTable";
import ButtonBack from "@/shared/components/ui/ButtonBack";
import type { WeekPick } from "@/features/activity/utils/activity";

type Range = { start?: string; end?: string };

export default function Page() {
  const [range, setRange] = useState<Range>({});
  const [sport, setSport] = useState<string>("all");

  const handlePick = useCallback((w: WeekPick) => {
    setRange({ start: w.start, end: w.end });
    setSport(w.sport || "all");
  }, []);

  return (
    <>
      {/* Sticky header s Back */}
      <ButtonBack title="Load trend" />

      {/* obsah */}
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
