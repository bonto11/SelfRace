"use client";

import CoachViewPanel from "@/features/coach/components/CoachViewPanel";
import { extractDailyPlan, DAY_ORDER, detectSport } from "@/features/coach/utils/plan";
import ActivitySingle from "@/shared/components/ActivitySingle";

/* ===== pomocné utily na ISO dátum z weekStart (Po) ===== */
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

/* ===== hlavný komponent ===== */
export default function PlanResult({ result }: { result: any }) {
  if (!result) return null;

  const plan      = result?.analysis?.next_week_plan;
  const daily     = extractDailyPlan(plan);
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

            return items.map((it: any, idx: number) => {
              const sport = detectSport(it) as "run" | "ride" | "strength" | "other" | "mixed";
              const dateIso = isoFromWeekStart(weekStart, day);

              // ľahká extrakcia labelov bez ťahania ďalších utilov
              const dur = it?.dur != null ? `${it.dur} min` : "";
              const intensity = it?.intensity ?? "";
              const target    = it?.target ?? "";
              const title     = it?.title ?? it?.name ?? "Session";
              const notes     = it?.notes ?? "";

              return (
                <ActivitySingle
                  key={`${day}-${idx}`}
                  variant="plan"
                  data={{
                    id: `${day}-${idx}`,
                    name: title,
                    dateIso: dateIso ?? undefined,
                    sport,
                    planDur: dur || null,
                    planIntensity: intensity || null,
                    planTarget: target || null,
                    planNotes: notes || null,
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
    </div>
  );
}