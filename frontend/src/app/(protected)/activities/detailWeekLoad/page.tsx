import { Suspense } from "react";
import TrendWeeklyLoad from "@/features/activity/components/TrendWeeklyLoad";

export const dynamic = "force-dynamic";

export default function DetailWeekLoadPage() {
  return (
    <Suspense fallback={<div className="p-6">Načítavam…</div>}>
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Weekly Load – detail</h2>
        <TrendWeeklyLoad />
      </div>
    </Suspense>
  );
}
