"use client";

import { useCallback, useState } from "react";
import { ActivityDataProvider } from "@/shared/components/dataProviders/ActivityDataProvider";
import TrendWeeklyLoad, { WeekPick } from "@/features/activity/components/TrendWeeklyLoad";
import ActivityTable from "@/shared/components/ActivityTable";
import ButtonBack from "@/shared/components/ui/ButtonBack";

type Range = { start?: string; end?: string };

export default function ActivitiesDetailPage() {
  const [range, setRange] = useState<Range>({});
  const [sport, setSport] = useState<string>("all");

  const handlePick = useCallback((w: WeekPick) => {
    console.debug("[DETAIL][onPickWeek]", w);
    setRange({ start: w.start, end: w.end });
    setSport(w.sport || "all");
  }, []);

  return (
    <ActivityDataProvider days={90}>
      <ButtonBack
        title="Detailný trend"
        href="/activities"
        label="Späť"
        className="mx-0 px-0"
        container={false}
      />

      <TrendWeeklyLoad
        onPickWeek={handlePick}
        onSportChange={(s) => {
          console.debug("[DETAIL][sport change]", s);
          setSport(s);
        }}
      />

      <div className="mt-3">
        <ActivityTable start={range.start} end={range.end} sport={sport} />
      </div>
    </ActivityDataProvider>
  );
}