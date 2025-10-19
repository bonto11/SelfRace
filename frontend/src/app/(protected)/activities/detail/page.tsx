// src/app/(protected)/activities/detail/page.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { ActivityDataProvider } from "@/features/activity/data/ActivityDataProvider";
import TrendWeeklyLoad from "@/features/activity/components/TrendWeeklyLoad";
import ActivityTable from "@/features/activity/components/ActivityTable";

export default function ActivityDetailPage() {
  const [range, setRange] = useState<{ start?: string; end?: string }>({});

  return (
    <ActivityDataProvider days={90}>
      <div className="flex items-center justify-end mb-3">
        <Link
          href="/activities"
          className="text-sm px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600"
        >
          ← Späť
        </Link>
      </div>

      <TrendWeeklyLoad
        showLookback
        onPickWeek={(w) => setRange({ start: w.start, end: w.end })}
      />

      <div className="mt-4">
        <ActivityTable start={range.start} end={range.end} />
      </div>
    </ActivityDataProvider>
  );
}