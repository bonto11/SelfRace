// app/(protected)/activities/detailWeekLoad/page.tsx
"use client";

import { Suspense } from "react";
import TrendWeeklyLoad from "@/features/activity/components/TrendWeeklyLoad";

export const dynamic = "force-dynamic"; // nech sa vždy načíta čerstvo

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Načítavam…</div>}>
      <div className="p-0">
        <TrendWeeklyLoad />
      </div>
    </Suspense>
  );
}
