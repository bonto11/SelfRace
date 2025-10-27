// src/features/coach/components/Result.tsx
"use client";

import Calendar from "./Calendar";
import { extractDailyPlan, getItemLabel } from "@/features/coach/utils/plan";

function DayItem({ it }: { it: any }) {
  const { title, dur, intensity, notes } = getItemLabel(it);
  return (
    <li className="text-sm">
      <b>{title}</b>
      {dur ? <> — {dur} min</> : null}
      {intensity ? <> ({intensity})</> : null}
      {notes ? (
        <>
          {" "}
          — <span className="opacity-80">{notes}</span>
        </>
      ) : null}
    </li>
  );
}

export default function Result({ result }: { result: any }) {
  if (!result) return null;

  const plan = result?.analysis?.next_week_plan;
  const daily = extractDailyPlan(plan);

  return (
    <div className="mt-4 bg-gray-800 p-4 rounded space-y-4">
      <p className="opacity-80 text-sm">
        model: {result?.model}
        {result?.analysis?._meta?.plan_source === "fallback_min" && (
          <span className="ml-2 inline-block text-xs bg-amber-600/30 border border-amber-600 text-amber-200 px-2 py-0.5 rounded">
            fallback plan
          </span>
        )}
        {result?.analysis?._meta?.coerced && (
          <span className="ml-2 inline-block text-xs bg-blue-600/30 border border-blue-600 text-blue-200 px-2 py-0.5 rounded">
            coerced
          </span>
        )}
      </p>

      {result?.analysis?.summary && (
        <>
          <h3 className="font-semibold">Summary</h3>
          <p>{result.analysis.summary}</p>
        </>
      )}

      {daily ? (
        <Calendar daily={daily} />
      ) : (
        plan && (
          <>
            <h3 className="font-semibold">Next week</h3>
            <div className="grid md:grid-cols-2 gap-3">
              {/* Run */}
              {plan.run && (
                <div className="bg-gray-900/40 border border-gray-700 rounded p-3">
                  <h4 className="font-semibold mb-1">Run</h4>
                  <p className="text-sm opacity-80">
                    weekly_km_target: {plan.run.weekly_km_target ?? "—"}
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    {(plan.run.sessions ?? []).map((s: any, i: number) => (
                      <DayItem key={i} it={s} />
                    ))}
                  </ul>
                </div>
              )}

              {/* Ride */}
              {plan.ride && (
                <div className="bg-gray-900/40 border border-gray-700 rounded p-3">
                  <h4 className="font-semibold mb-1">Ride</h4>
                  <p className="text-sm opacity-80">
                    weekly_time_target:{" "}
                    {plan.ride.weekly_time_target_min ?? "—"} min
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    {(plan.ride.sessions ?? []).map((s: any, i: number) => (
                      <DayItem key={i} it={s} />
                    ))}
                  </ul>
                </div>
              )}

              {/* Strength */}
              {plan.strength && (
                <div className="bg-gray-900/40 border border-gray-700 rounded p-3 md:col-span-2">
                  <h4 className="font-semibold mb-1">Strength</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    {(plan.strength.sessions ?? []).map((s: any, i: number) => (
                      <DayItem key={i} it={s} />
                    ))}
                  </ul>
                  {Array.isArray(plan.rest_days) && (
                    <p className="mt-2 text-sm opacity-80">
                      <b>Rest days:</b> {plan.rest_days.join(", ")}
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )
      )}

      {/* Posledná poistka – ak model nevrátil plán */}
      {!daily && !plan && (
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
