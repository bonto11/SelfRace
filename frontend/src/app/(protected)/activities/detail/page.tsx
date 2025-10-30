"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { ActivityDataProvider } from "@/features/activity/data/ActivityDataProvider";
import TrendWeeklyLoad, { WeekPick } from "@/features/activity/components/TrendWeeklyLoad";
import ActivityTable from "@/shared/components/ActivityTable";

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
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">Detailný trend</h2>
        <Link href="/activities" className="text-sm px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600">
          ← Späť
        </Link>
      </div>

      <TrendWeeklyLoad
        onPickWeek={handlePick}
        onSportChange={(s) => { console.debug("[DETAIL][sport change]", s); setSport(s); }}
      />

      <div className="mt-3">
        <ActivityTable start={range.start} end={range.end} sport={sport} />
      </div>
    </ActivityDataProvider>
  );
}