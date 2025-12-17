// src/features/coach/components/PlanPreview.tsx
"use client";

import { CARD, NO_X_OVERFLOW } from "@/shared/ui/classes";
import SessionCard from "@/shared/components/SessionCard";
import { detectSport } from "@/features/coach/utils/plan";
import { findTrainingTypeById } from "@/shared/types/training";

/* ───────── helpers ───────── */
type AnyObj = Record<string, any>;

function hrToText(hr?: any): string | null {
  if (!hr) return null;
  if (Array.isArray(hr) && hr.length === 2 && hr.every((x) => Number.isFinite(x))) {
    return `HR ${hr[0]}–${hr[1]}`;
  }
  return null;
}
function paceToText(p?: any): string | null {
  return typeof p === "string" && p.trim() ? `pace ${p}` : null;
}
function powerToText(w?: any): string | null {
  return Number.isFinite(w) ? `power ${w}W` : null;
}

function normTarget(it: AnyObj): string | null {
  const hr = it?.target_hr_bpm_range ?? it?.target_hr ?? null;
  const pace = it?.target_pace_min_per_km ?? null;
  const pow = it?.target_power_watts ?? null;

  const mainT = Array.isArray(it?.structure?.main)
    ? it.structure.main[0]?.target
    : it?.structure?.main?.target;

  const hr2 = hr ?? mainT?.hr ?? mainT?.heart_rate ?? null;
  const pace2 = pace ?? mainT?.pace ?? null;
  const pow2 = pow ?? mainT?.power ?? null;

  const parts = [hrToText(hr2), paceToText(pace2), powerToText(pow2)].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function intervalsToText(main: any): string | null {
  const arr = Array.isArray(main) ? main : (main && Array.isArray(main.sets) ? main.sets : null);
  if (!arr || !arr.length) return null;

  const first = arr[0];
  const reps = Number.isFinite(first?.reps) ? `${first.reps}×` : "";
  const work = Number.isFinite(first?.work_min) ? `${first.work_min}′` : "";
  const rec =
    Number.isFinite(first?.recover_min) && first.recover_min > 0 ? ` / ${first.recover_min}′ rec` : "";
  const targ = first?.target
    ? [hrToText(first.target.hr), paceToText(first.target.pace), powerToText(first.target.power)]
        .filter(Boolean)
        .join(" · ")
    : "";

  const txt = [reps && work ? `${reps}${work}` : work || reps, rec, targ].filter(Boolean).join(" ");
  return txt || null;
}

function toIso(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function parseIso(iso?: string | null): Date | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
}

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

function normNotes(it: AnyObj) {
  if (it?.notes) return it.notes;

  const wu = it?.structure?.warmup
    ? [
        it.structure.warmup?.notes ? `WU: ${it.structure.warmup.notes}` : null,
        hrToText(it.structure.warmup?.target?.hr),
        paceToText(it.structure.warmup?.target?.pace),
        powerToText(it.structure.warmup?.target?.power),
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const main = it?.structure?.main ? intervalsToText(it.structure.main) : "";

  const cd = it?.structure?.cooldown
    ? [
        it.structure.cooldown?.notes ? `CD: ${it.structure.cooldown.notes}` : null,
        hrToText(it.structure.cooldown?.target?.hr),
        paceToText(it.structure.cooldown?.target?.pace),
        powerToText(it.structure.cooldown?.target?.power),
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const ex =
    Array.isArray(it?.exercises) && it.exercises.length
      ? "Exercises: " +
        it.exercises
          .map((e: any) => {
            const parts = [e?.name, e?.sets ? `${e.sets}x` : ""];
            if (e?.seconds) parts.push(`${e.seconds}s`);
            else if (e?.reps) parts.push(`${e.reps}`);
            return parts.filter(Boolean).join(" ");
          })
          .join(", ")
      : "";

  const parts = [wu, main, cd, ex].filter(Boolean);
  return parts.length ? parts.join(" • ") : null;
}

function WeekPreview({ lines }: { lines: string[] }) {
  if (!lines?.length) return null;
  return (
    <div className={[CARD, "p-3 bg-white/70 dark:bg-gray-900/40"].join(" ")}>
      <h3 className="font-semibold mb-1">Weekly preview</h3>
      <ul className="list-disc pl-5 text-sm">
        {lines.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  );
}

/* ───────── component ───────── */

export default function PlanPreview({
  result,
  showDebugSplit = false,
  showNarrative = false,
}: {
  result: any;
  showDebugSplit?: boolean;
  showNarrative?: boolean;
}) {
  if (!result) return null;

  const analysis = result?.analysis ?? {};
  const preview: string[] = analysis?.weeks_overview || analysis?.outline_10w || [];

  const next10Raw: any[] = (Array.isArray(analysis?.next_10_days) && analysis.next_10_days) || [];

  const metaStart: string | null =
    analysis?._meta?.next10_start ||
    (next10Raw.length && typeof next10Raw[0]?.day === "string" ? next10Raw[0].day : null) ||
    null;

  const startDateObj = parseIso(metaStart || undefined);

  const safeDates: string[] = startDateObj
    ? Array.from({ length: 10 }, (_, i) =>
        toIso(
          new Date(
            Date.UTC(
              startDateObj.getUTCFullYear(),
              startDateObj.getUTCMonth(),
              startDateObj.getUTCDate() + i,
              12,
              0,
              0
            )
          )
        )
      )
    : [];

  const byDate: Record<string, any[]> = {};
  for (const entry of next10Raw) {
    if (entry && typeof entry === "object" && typeof entry.day === "string") {
      const sessions = Array.isArray(entry.sessions) ? entry.sessions : entry.title ? [entry] : [];
      byDate[entry.day] = sessions;
    }
  }

  return (
    <div className="max-w-screen-lg w-full mx-auto px-3 md:px-4 lg:px-6 space-y-4">
      {/* Narrative */}
      {showNarrative && result?.narrative && (
        <div className={[CARD, "p-3 md:p-4"].join(" ")}>
          <div className="text-sm opacity-80">Narrative hidden placeholder</div>
        </div>
      )}

      {/* SUMMARY */}
      {(analysis?.summary || preview.length) && (
        <section className={[CARD, "p-4 md:p-5 space-y-3"].join(" ")}>
          <div className="flex justify-between items-center mb-1">
            <h2 className="text-lg font-bold">Tréningový plán — prehľad</h2>
          </div>

          {analysis?.summary && (
            <div className="rounded-xl border border-white/10 p-3 bg-white/70 dark:bg-gray-900/40">
              <h3 className="font-semibold mb-1">Summary</h3>
              <p>{analysis.summary}</p>
            </div>
          )}

          {Array.isArray(analysis?.insights) && analysis.insights.length > 0 && (
            <div className="rounded-xl border border-white/10 p-3 bg-white/70 dark:bg-gray-900/40">
              <h3 className="font-semibold mb-1">Insights</h3>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {analysis.insights.map((ins: any, idx: number) => (
                  <li key={idx}>{String(ins)}</li>
                ))}
              </ul>
            </div>
          )}

          {!!preview.length && <WeekPreview lines={preview} />}
        </section>
      )}

      {/* NEXT 10 DAYS */}
      {safeDates.length > 0 && (
        <section className={[CARD, "p-4 md:p-5"].join(" ")}>
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-bold">Next 10 days</h2>
          </div>

          <ul className={["space-y-2", NO_X_OVERFLOW, "overflow-visible"].join(" ")}>
            {safeDates.map((iso) => {
              const sessions = byDate[iso] || [];

              if (!sessions.length) {
                return (
                  <li key={`d10-${iso}-empty`} className="px-0">
                    <SessionCard
                      variant="plan"
                      showPlanDebug={showDebugSplit}
                      item={{
                        id: `d10-${iso}-empty`,
                        kind: "plan",
                        title: "—",
                        dateIso: iso,
                        sport: "other",
                        status: "planned",
                        planDur: null,
                        planIntensity: null,
                        planTarget: null,
                        planNotes: null,
                        planRaw: null,
                        planStructure: null,
                        planExercises: [],
                        defaultOpen: false,
                      }}
                    />
                  </li>
                );
              }

              return sessions.map((it: AnyObj, sidx: number) => {
                const sessionTypeId = typeof it?.session_type === "string" ? it.session_type : null;
                const trainingDef = findTrainingTypeById(sessionTypeId);

                const title = trainingDef?.label || normTitle(it);

                const baseNotes = normNotes(it);
                const typeLine = trainingDef?.description || null;
                const combinedNotes = [typeLine, baseNotes].filter(Boolean).join(" • ");

                return (
                  <li key={`d10-${iso}-${sidx}`} className="px-0">
                    <SessionCard
                      variant="plan"
                      showPlanDebug={showDebugSplit}
                      item={{
                        id: `d10-${iso}-${sidx}`,
                        kind: "plan",
                        title,
                        dateIso: iso,
                        sport: (detectSport(it) as any) ?? "other",
                        status: "planned",
                        planDur: normDuration(it),
                        planIntensity: normIntensity(it),
                        planTarget: normTarget(it),
                        planNotes: combinedNotes || null,
                        planRaw: it,
                        planStructure: it?.structure ?? null,
                        planExercises: it?.exercises ?? null,
                        defaultOpen: false,
                      }}
                    />
                  </li>
                );
              });
            })}
          </ul>

          {showDebugSplit && (
            <pre className="text-xs bg-black/30 p-2 rounded overflow-auto mt-3">
              {JSON.stringify(analysis, null, 2)}
            </pre>
          )}
        </section>
      )}
    </div>
  );
}