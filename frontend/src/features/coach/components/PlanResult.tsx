// src/features/coach/components/PlanResult.tsx
"use client";

import CoachViewPanel from "@/features/coach/components/CoachViewPanel";
import PlanCards from "@/features/coach/components/PlanCards";
import { extractDailyPlan } from "@/features/coach/utils/plan";

export default function PlanResult({ result }: { result: any }) {
  if (!result) return null;

  const plan = result?.analysis?.next_week_plan;
  const daily = extractDailyPlan(plan);
  const weekStart = result?.analysis?._meta?.week_start as string | undefined;

  return (
    <div className="space-y-3">
      <CoachViewPanel narrative={result?.narrative} />

      {result?.analysis?.summary && (
        <div className="rounded-2xl border border-white/10 p-3 bg-white/90 dark:bg-gray-900/70 backdrop-blur">
          <h3 className="font-semibold mb-1">Summary</h3>
          <p>{result.analysis.summary}</p>
        </div>
      )}

      {daily ? (
        <PlanCards daily={daily} weekStart={weekStart} />
      ) : plan ? (
        <div className="rounded-2xl border border-white/10 p-3 bg-white/90 dark:bg-gray-900/70 backdrop-blur">
          <h3 className="font-semibold mb-1">Next week</h3>
          <pre className="text-xs bg-black/30 p-2 rounded overflow-auto">
            {JSON.stringify(plan, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}