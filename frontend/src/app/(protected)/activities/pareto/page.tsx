// src/app/(protected)/activities/pareto/page.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { ActivityDataProvider } from "@/features/activity/data/ActivityDataProvider";
import TrendPareto8020 from "@/features/activity/components/TrendPareto8020";
import ActivityTable from "@/features/activity/components/ActivityTable";

type Range = { start?: string; end?: string };

export default function ParetoDetailPage() {
  const [range, setRange] = useState<Range>({});

  // 12 týždňov (84 dní) – jeden fetch + cache v sessionStorage
  return (
    <ActivityDataProvider days={84}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">80/20 – detailný trend</h2>
        <Link href="/activities" className="text-sm px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600">
          ← Späť
        </Link>
      </div>

      <TrendPareto8020 onPickWeek={(w) => setRange({ start: w.start, end: w.end })} />

      <div className="mt-3">
        <ActivityTable start={range.start} end={range.end} />
      </div>
    </ActivityDataProvider>
  );
}