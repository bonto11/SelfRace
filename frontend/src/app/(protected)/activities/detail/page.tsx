// src/app/(protected)/activities/detail/page.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { ActivityDataProvider } from "@/features/activity/data/ActivityDataProvider";
import TrendWeeklyLoad from "@/features/activity/components/TrendWeeklyLoad";
import ActivityTable from "@/features/activity/components/ActivityTable";

type Range = { start?: string; end?: string };

export default function ActivitiesDetailPage() {
  const [range, setRange] = useState<Range>({});

  return (
    <ActivityDataProvider days={90}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">Detailný trend</h2>
        <Link href="/activities" className="text-sm px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600">
          ← Späť
        </Link>
      </div>

      <TrendWeeklyLoad onPickWeek={(w) => setRange({ start: w.start, end: w.end })} />
      <div className="mt-3">
        <ActivityTable start={range.start} end={range.end} />
      </div>
    </ActivityDataProvider>
  );
}