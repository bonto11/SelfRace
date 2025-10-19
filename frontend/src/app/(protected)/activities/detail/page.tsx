// src/app/(protected)/activity/page.tsx  (príklad)
// src/app/(protected)/activities/detail/page.tsx
"use client";

import Link from "next/link";
import { useState } from "react";

import { ActivityDataProvider } from "@/features/activity/data/ActivityDataProvider";
import TrendWeeklyLoad from "@/features/activity/components/TrendWeeklyLoad";
import ActivityTable from "@/features/activity/components/ActivityTable";

export default function ActivityDetailPage() {
  // držím si vybratý rozsah z grafu
  const [range, setRange] = useState<{ start?: string; end?: string }>({});

  return (
    <ActivityDataProvider>
      <div className="space-y-3">
        <Link
          href="/activities"
          className="text-sm px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600"
        >
          ← Späť
        </Link>

        <TrendWeeklyLoad
          onPickWeek={(w) => setRange({ start: w.start, end: w.end })}
        />

        <ActivityTable start={range.start} end={range.end} />
      </div>
    </ActivityDataProvider>
  );
}
