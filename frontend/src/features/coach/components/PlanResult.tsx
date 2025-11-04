// src/features/coach/components/PlanResult.tsx
"use client";

import CoachViewPanel from "@/features/coach/components/CoachViewPanel";
import PlanTable from "@/features/coach/components/PlanTable";
import { extractDailyPlan } from "@/features/coach/utils/plan";

export default function PlanResult({ result }: { result: any }) {
  if (!result) return null;

  const plan = result?.analysis?.next_week_plan;
  const daily = extractDailyPlan(plan);
  const weekStart = result?.analysis?._meta?.week_start as string | undefined;

  return (
    <div className="space-y-3">
      {/* Coach view v tvojom UI */}
      <CoachViewPanel narrative={result?.narrative} />

      {/* Summary box (ponechaný ako doteraz, ale môžeš ho tiež obaliť do CARD ak chceš) */}
      {result?.analysis?.summary && (
        <div className="bg-gray-900/40 border border-gray-700 rounded p-3">
          <h3 className="font-semibold mb-1">Summary</h3>
          <p>{result.analysis.summary}</p>
        </div>
      )}

      {/* Hlavná tabuľka plánu */}
      {daily ? (
        <PlanTable daily={daily} weekStart={weekStart}/>
      ) : plan ? (
        // fallback bloky (ak príde štruktúrované inak)
        <div className="bg-gray-900/40 border border-gray-700 rounded p-3">
          <h3 className="font-semibold mb-1">Next week</h3>
          <pre className="text-xs bg-black/40 p-2 rounded overflow-auto">
            {JSON.stringify(plan, null, 2)}
          </pre>
        </div>
      ) : (
        <details>
          <summary className="cursor-pointer">Raw output</summary>
          <pre className="text-xs bg-black/40 p-2 rounded overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}