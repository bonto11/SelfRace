// src/app/(protected)/activities/detail/page.tsx
"use client";

import { useCallback, useState } from "react";
import TrendWeeklyLoad, {
  WeekPick,
} from "@/features/activity/components/TrendWeeklyLoad";
import ActivityTable from "@/shared/components/ActivityTable";
import ButtonBack from "@/shared/components/ui/ButtonBack";

type Range = { start?: string; end?: string };

export default function ActivitiesLoadPage() {
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
          <TrendWeeklyLoad
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
