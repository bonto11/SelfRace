"use client";

import { useEffect } from "react";
import CoachViewPanel from "@/features/coach/components/CoachViewPanel";
import { extractDailyPlan, DAY_ORDER, detectSport } from "@/features/coach/utils/plan";
import ActivitySingle from "@/shared/components/ActivitySingle";

/* ===== ISO utils ===== */
const DAY_OFFSET: Record<(typeof DAY_ORDER)[number], number> = {
  Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
};
function parseIsoDate(iso?: string | null): Date | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
  return new Date(Date.UTC(y, mo, d, 12, 0, 0));
}
function toIso(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function isoFromWeekStart(weekStartIso: string | undefined, day: (typeof DAY_ORDER)[number]): string | null {
  if (!weekStartIso) return null;
  const base = parseIsoDate(weekStartIso);
  if (!base) return null;
  const off = DAY_OFFSET[day] ?? 0;
  const d = new Date(base);
  d.setUTCDate(base.getUTCDate() + off);
  return toIso(d);
}
function addDays(iso: string, n: number): string {
  const d = parseIsoDate(iso); if (!d) return iso;
  const c = new Date(d); c.setUTCDate(d.getUTCDate() + n);
  return toIso(c);
}

/* ===== Normalizácia pre ActivitySingle ===== */
type AnyObj = Record<string, any>;

function normTitle(it: AnyObj) {
  return it?.title ?? it?.name ?? "Session";
}
function normDuration(it: AnyObj) {
  const minutes =
    (typeof it?.duration_min === "number" && it.duration_min) ??
    (typeof it?.dur === "number" && it.dur) ??
    null;
  return minutes != null ? `${minutes} min` : null;
}
function normIntensity(it: AnyObj) {
  return it?.intensity ?? null;
}
function normTarget(it: AnyObj) {
  return (
    it?.target_pace_min_per_km ??
    it?.target ??
    it?.structure?.main?.target?.pace ??
    null
  );
}
function normNotes(it: AnyObj) {
  if (it?.notes) return it.notes;
  const wu = it?.structure?.warmup?.notes ? `WU: ${it.structure.warmup.notes}` : "";
  const cd = it?.structure?.cooldown?.notes ? `CD: ${it.structure.cooldown.notes}` : "";
  const extra =
    it?.exercises && Array.isArray(it.exercises) && it.exercises.length
      ? `Exercises: ` +
        it.exercises
          .map((e: any) =>
            [e?.name, e?.sets ? `${e.sets}x` : "", e?.reps ? `${e.reps}` : ""].filter(Boolean).join(" ")
          )
          .join(", ")
      : "";
  const parts = [wu, cd, extra].filter(Boolean);
  return parts.length ? parts.join(" • ") : null;
}

/* ===== komponent ===== */
export default function PlanResult({
  result,
  showDebugSplit = true,
}: {
  result: any;
  showDebugSplit?: boolean;
}) {
  if (!result) return null;

  const analysis   = result?.analysis ?? {};
  const plan       = analysis?.next_week_plan;
  const daily      = extractDailyPlan(plan);
  const weekStart  = analysis?._meta?.week_start as string | undefined;
  const first10    = Array.isArray(analysis?.next_10_days) ? analysis.next_10_days as AnyObj[] : [];
  const planStart  = (result?.context_used?.plan_start_date as string | undefined) || undefined;

  /* Ulož AI výstup do storage: coach.generated */
  useEffect(() => {
    try {
      if (analysis && Object.keys(analysis).length) {
        localStorage.setItem("coach.generated", JSON.stringify(analysis));
      }
    } catch {/* ignore quota / SSR */}
  }, [analysis]);

  return (
    <div className="space-y-3">
      {/* Narrative */}
      {result?.narrative && <CoachViewPanel narrative={result.narrative} />}

      {/* Summary */}
      {analysis?.summary && (
        <div className="rounded-xl border border-white/10 p-3 bg-white/70 dark:bg-gray-900/40">
          <h3 className="font-semibold mb-1">Summary</h3>
          <p>{analysis.summary}</p>
        </div>
      )}

      {/* First 10 days (ak sú) */}
      {first10.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-semibold px-1">First 10 days</h3>
          {first10.map((it, i) => {
            // dátum preferuj z item.date, inak z plan_start_date + index
            const explicit = typeof it?.date === "string" ? it.date : null;
            const dateIso = explicit ?? (planStart ? addDays(planStart, i) : undefined);
            const sport = (detectSport(it) as "run" | "ride" | "strength" | "other" | "mixed") ?? "other";
            return (
              <ActivitySingle
                key={`d10-${i}`}
                variant="plan"
                data={{
                  id: `d10-${i}`,
                  name: normTitle(it),
                  dateIso: dateIso ?? undefined,
                  sport,
                  planDur: normDuration(it),
                  planIntensity: normIntensity(it),
                  planTarget: normTarget(it),
                  planNotes: normNotes(it),
                  // surové pre detail
                  planRaw: it,
                  planStructure: it?.structure ?? null,
                  planExercises: it?.exercises ?? null,
                }}
                defaultOpen={false}
              />
            );
          })}
        </section>
      )}

      {/* Týždenné karty (ako doteraz) */}
      {Array.isArray(daily) && daily.length > 0 ? (
        <div className="space-y-2">
          {daily.flatMap(({ day, items }) => {
            if (!items?.length) {
              const dateIso = isoFromWeekStart(weekStart, day);
              return (
                <ActivitySingle
                  key={`${day}-empty`}
                  variant="plan"
                  data={{
                    id: `${day}-empty`,
                    name: "—",
                    dateIso: dateIso ?? undefined,
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

            return items.map((it: AnyObj, idx: number) => {
              const sport = (detectSport(it) as "run" | "ride" | "strength" | "other" | "mixed") ?? "other";
              const dateIso = isoFromWeekStart(weekStart, day);
              return (
                <ActivitySingle
                  key={`${day}-${idx}`}
                  variant="plan"
                  data={{
                    id: `${day}-${idx}`,
                    name: normTitle(it),
                    dateIso: dateIso ?? undefined,
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
      ) : plan ? (
        <div className="rounded-xl border border-white/10 p-3 bg-white/70 dark:bg-gray-900/40">
          <h3 className="font-semibold mb-1">Next week</h3>
          <pre className="text-xs bg-black/30 p-2 rounded overflow-auto">
            {JSON.stringify(plan, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}