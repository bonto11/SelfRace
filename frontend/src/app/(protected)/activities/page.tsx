// src/app/(protected)/activities/page.tsx
"use client";

import { useState } from "react";
import TrendWeeklyLoad, { WeekPick } from "@/components/Activity/TrendWeeklyLoad";
import ActivityTable from "@/components/Activity/ActivityTable";

export default function ActivitiesPage() {
  const [picked, setPicked] = useState<WeekPick | null>(null);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Aktivity – posledný mesiac</h2>
        {picked && (
          <div className="text-xs bg-blue-900/40 border border-blue-700 rounded px-2 py-1">
            Filter: {picked.week} ({picked.start} – {picked.end})
            <button
              className="ml-2 underline"
              onClick={() => setPicked(null)}
            >
              zrušiť
            </button>
          </div>
        )}
      </div>

      <TrendWeeklyLoad onPickWeek={setPicked} />

      <div className="mt-6">
        <ActivityTable filterRange={picked ? { start: picked.start, end: picked.end } : null} />
      </div>
    </div>
  );
}