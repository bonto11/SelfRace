"use client";

import CoachViewPanel from "@/features/coach/components/CoachViewPanel";
import { extractDailyPlan, DAY_ORDER, detectSport } from "@/features/coach/utils/plan";
import ActivitySingle from "@/shared/components/ActivitySingle";

/* ===== ISO dátum z weekStart (Po) ===== */
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

/* ===== Normalizácia polí z AI itemu → to čo žerie ActivitySingle ===== */
type AnyObj = Record<string, any>;

function normTitle(it: AnyObj) {
  return it?.title ?? it?.name ?? "Session";
}
function normDuration(it: AnyObj) {
  // podporuj duration_min (AI) aj pôvodné dur
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
  // viac zdrojov: target_pace_min_per_km | target | structure.main.target.pace
  return (
    it?.target_pace_min_per_km ??
    it?.target ??
    it?.structure?.main?.target?.pace ??
    null
  );
}
function normNotes(it: AnyObj) {
  // podpor aj warmup/cooldown poznámky, ak nie sú top-level
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

/* ===== Krátke čipy pre debug výpis ===== */
function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-block rounded-md bg-white/10 px-2 py-0.5 text-xs">{children}</span>;
}

/* ===== hlavný komponent ===== */
export default function PlanResult({ result, showDebugSplit = true }: { result: any; showDebugSplit?: boolean }) {
  if (!result) return null;

  const plan      = result?.analysis?.next_week_plan;
  const daily     = extractDailyPlan(plan); // zachované tvoje utils
  const weekStart = result?.analysis?._meta?.week_start as string | undefined;

  return (
    <div className="space-y-3">
      {/* Coach narrative */}
      {result?.narrative && <CoachViewPanel narrative={result.narrative} />}

      {/* Summary */}
      {result?.analysis?.summary && (
        <div className="rounded-xl border border-white/10 p-3 bg-white/70 dark:bg-gray-900/40">
          <h3 className="font-semibold mb-1">Summary</h3>
          <p>{result.analysis.summary}</p>
        </div>
      )}

      {/* Karty dňa – priamo ActivitySingle (variant "plan") */}
      {Array.isArray(daily) && daily.length > 0 ? (
        <div className="space-y-2">
          {daily.flatMap(({ day, items }) => {
            // prázdny deň
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
                  }}
                  defaultOpen={false}
                />
              );
            }

            return items.map((it: AnyObj, idx: number) => {
              // detekcia športu nech ostáva cez tvoju utilitu
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
                  }}
                  defaultOpen={false}
                />
              );
            });
          })}
        </div>
      ) : plan ? (
        // fallback – ak sa nepodarilo rozkúskovať na daily
        <div className="rounded-xl border border-white/10 p-3 bg-white/70 dark:bg-gray-900/40">
          <h3 className="font-semibold mb-1">Next week</h3>
          <pre className="text-xs bg-black/30 p-2 rounded overflow-auto">
            {JSON.stringify(plan, null, 2)}
          </pre>
        </div>
      ) : null}

      {/* --- Textový daily split (debug) — voliteľný, default zapnutý --- */}
      {showDebugSplit && Array.isArray(daily) && daily.length > 0 && (
        <div className="rounded-xl border border-white/10 p-3 bg-white/5 space-y-3">
          <h3 className="font-semibold">Daily split (text)</h3>
          {daily.map(({ day, items }) => (
            <div key={`dbg-${day}`} className="space-y-1">
              <div className="text-xs uppercase tracking-wide opacity-80">{day}</div>
              {!items?.length ? (
                <div className="text-sm opacity-70">— no session —</div>
              ) : (
                items.map((it: AnyObj, i: number) => {
                  const sport = (detectSport(it) as string) || "other";
                  return (
                    <div key={`dbg-${day}-${i}`} className="rounded-md border border-white/10 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium">{normTitle(it)}</div>
                        <Chip>{sport}</Chip>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs opacity-90 mt-1">
                        {normDuration(it) && <Chip>duration: {normDuration(it)}</Chip>}
                        {normIntensity(it) && <Chip>intensity: {normIntensity(it)}</Chip>}
                        {normTarget(it) && <Chip>target: {String(normTarget(it))}</Chip>}
                      </div>
                      {normNotes(it) && <div className="text-sm mt-1">{normNotes(it)}</div>}
                    </div>
                  );
                })
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}