// src/features/coach/components/PlanResult.tsx
"use client";

import CoachViewPanel from "@/features/coach/components/CoachViewPanel";
import { extractDailyPlan, DAY_ORDER, detectSport } from "@/features/coach/utils/plan";
import ActivitySingle from "@/shared/components/ActivitySingle";

function toIso(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth()+1).padStart(2,"0");
  const dd = String(d.getUTCDate()).padStart(2,"0");
  return `${y}-${m}-${dd}`;
}
function parseIso(iso?: string|null): Date|null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2])-1, Number(m[3]), 12,0,0));
}

type AnyObj = Record<string, any>;

function normTitle(it: AnyObj) { return it?.title ?? it?.name ?? "Session"; }
function normDuration(it: AnyObj) {
  const minutes = (typeof it?.duration_min === "number" && it.duration_min) ?? (typeof it?.dur === "number" && it.dur) ?? null;
  return minutes != null ? `${minutes} min` : null;
}
function normIntensity(it: AnyObj) { return it?.intensity ?? null; }
function normTarget(it: AnyObj) {
  return it?.target_pace_min_per_km ?? it?.target ?? it?.structure?.main?.[0]?.target?.pace ?? it?.structure?.main?.target?.pace ?? null;
}
function normNotes(it: AnyObj) {
  if (it?.notes) return it.notes;
  const wu = it?.structure?.warmup?.notes ? `WU: ${it.structure.warmup.notes}` : "";
  const cd = it?.structure?.cooldown?.notes ? `CD: ${it.structure.cooldown.notes}` : "";
  const ex = Array.isArray(it?.exercises) && it.exercises.length
    ? "Exercises: " + it.exercises.map((e: any) => {
        const parts = [e?.name, e?.sets ? `${e.sets}x` : ""];
        if (e?.seconds) parts.push(`${e.seconds}s`);
        else if (e?.reps) parts.push(`${e.reps}`);
        return parts.filter(Boolean).join(" ");
      }).join(", ")
    : "";
  const parts = [wu, cd, ex].filter(Boolean);
  return parts.length ? parts.join(" • ") : null;
}

function WeekPreview({ lines }: { lines: string[] }) {
  if (!lines?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 p-3 bg-white/70 dark:bg-gray-900/40">
      <h3 className="font-semibold mb-1">Weekly preview</h3>
      <ul className="list-disc pl-5 text-sm">
        {lines.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    </div>
  );
}

export default function PlanResult({ result, showDebugSplit = false }: { result: any; showDebugSplit?: boolean }) {
  if (!result) return null;

  // === summary & classic 7-dňový plan (pre ActivitySingle cez extractDailyPlan) ===
  const plan      = result?.analysis?.next_week_plan;
  const daily     = extractDailyPlan(plan);
  const weekStart = result?.analysis?._meta?.week_start as string | undefined;

  // === weekly preview (outline) ===
  const preview = result?.analysis?.week_overview || result?.analysis?.outline_10w || [];

  // === FIRST 10 DAYS – preferuj serverom koercované 'first_10_days' + dátum z _meta.next10_start/goal.start_date ===
  const first10 = Array.isArray(result?.analysis?.first_10_days) ? result.analysis.first_10_days : null;
  const next10Start = result?.analysis?._meta?.next10_start || result?.analysis?.goal?.start_date || null;
  const startDateObj = parseIso(next10Start);
  const safeDates = startDateObj ? Array.from({length:10}, (_,i)=> toIso(new Date(Date.UTC(startDateObj.getUTCFullYear(), startDateObj.getUTCMonth(), startDateObj.getUTCDate()+i, 12,0,0)))) : [];

  return (
    <div className="space-y-3">
      {result?.narrative && <CoachViewPanel narrative={result.narrative} />}

      {result?.analysis?.summary && (
        <div className="rounded-xl border border-white/10 p-3 bg-white/70 dark:bg-gray-900/40">
          <h3 className="font-semibold mb-1">Summary</h3>
          <p>{result.analysis.summary}</p>
        </div>
      )}

      {!!preview.length && <WeekPreview lines={preview} />}

      {/* --- Next 10 days --- */}
      {first10 && startDateObj && (
        <section className="rounded-xl border border-white/10 p-3 bg-white/5">
          <h3 className="font-semibold mb-2">Next 10 days</h3>
          <div className="space-y-2">
            {safeDates.map((iso, idx) => {
              const dayObj = first10.find((x: any) => x?.day === iso) || null;
              const sessions = Array.isArray(dayObj?.sessions) ? dayObj.sessions : [];
              if (!sessions.length) {
                return (
                  <ActivitySingle
                    key={`d10-${iso}-empty`}
                    variant="plan"
                    data={{
                      id: `d10-${iso}-empty`,
                      name: "—",
                      dateIso: iso,
                      sport: "other",
                      planDur: null,
                      planIntensity: null,
                      planTarget: null,
                      planNotes: null,
                      planRaw: null,
                      planStructure: null,
                      planExercises: null,
                    }}
                    defaultOpen={false}
                  />
                );
              }
              return sessions.map((it: AnyObj, sidx: number) => {
                const sport = (detectSport(it) as any) ?? "other";
                return (
                  <ActivitySingle
                    key={`d10-${iso}-${sidx}`}
                    variant="plan"
                    data={{
                      id: `d10-${iso}-${sidx}`,
                      name: normTitle(it),
                      dateIso: iso,
                      sport,
                      planDur: normDuration(it),
                      planIntensity: normIntensity(it),
                      planTarget: normTarget(it),
                      planNotes: normNotes(it),
                      planRaw: it,
                      planStructure: it?.structure ?? null,
                      planExercises: it?.exercises ?? null,
                    }}
                    defaultOpen={false}
                  />
                );
              });
            })}
          </div>
        </section>
      )}

      {/* --- Classic 7-day (Mon–Sun) from next_week_plan --- */}
      {Array.isArray(daily) && daily.length > 0 && (
        <section>
          <h3 className="font-semibold mb-2">7-day plan (next week)</h3>
          <div className="space-y-2">
            {daily.flatMap(({ day, items }) => {
              const dateIso = (() => {
                // ak máme weekStart, spočítaj dátum do ActivitySingle (ako doteraz)
                if (!weekStart) return undefined;
                const base = parseIso(weekStart);
                if (!base) return undefined;
                const idx = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].indexOf(day as any);
                const d = new Date(base); d.setUTCDate(base.getUTCDate() + (idx>=0?idx:0));
                return toIso(d);
              })();

              if (!items?.length) {
                return (
                  <ActivitySingle
                    key={`${day}-empty`}
                    variant="plan"
                    data={{ id:`${day}-empty`, name:"—", dateIso, sport:"other",
                      planDur:null, planIntensity:null, planTarget:null, planNotes:null,
                      planRaw:null, planStructure:null, planExercises:null }}
                    defaultOpen={false}
                  />
                );
              }
              return items.map((it: AnyObj, idx: number) => {
                const sport = (detectSport(it) as any) ?? "other";
                return (
                  <ActivitySingle
                    key={`${day}-${idx}`}
                    variant="plan"
                    data={{
                      id:`${day}-${idx}`,
                      name: normTitle(it),
                      dateIso,
                      sport,
                      planDur: normDuration(it),
                      planIntensity: normIntensity(it),
                      planTarget: normTarget(it),
                      planNotes: normNotes(it),
                      planRaw: it,
                      planStructure: it?.structure ?? null,
                      planExercises: it?.exercises ?? null,
                    }}
                    defaultOpen={false}
                  />
                );
              });
            })}
          </div>
        </section>
      )}

      {/* Debug split necháme default off, vieš si zapnúť parametrom */}
      {showDebugSplit && (
        <pre className="text-xs bg-black/30 p-2 rounded overflow-auto">
          {JSON.stringify(result?.analysis, null, 2)}
        </pre>
      )}
    </div>
  );
}