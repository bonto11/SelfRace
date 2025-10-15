import { Suspense } from "react";
import Link from "next/link";
import TrendWeeklyLoad from "@/features/activity/components/DetailWeeklyLoad";

export const dynamic = "force-dynamic";

export default function ActivitiesDetailPage() {
  return (
    <Suspense fallback={<div className="p-6">Načítavam…</div>}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-lg font-semibold">Detail – Weekly Load</h2>
        <Link href="/activities" className="text-sm px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-white">
          ← Späť
        </Link>
      </div>

      <TrendWeeklyLoad />
    </Suspense>
  );
}
