// src/features/coach/components/PlanActive.tsx
"use client";

import { CARD, NO_X_OVERFLOW } from "@/shared/ui/classes";
import SessionCard from "@/shared/components/SessionCard";
import { usePlanData } from "@/shared/components/dataProviders/PlanDataProvider";
import { detectSport } from "@/features/coach/utils/plan";
import { findTrainingTypeById } from "@/shared/types/training";
import { todayISO, addDays } from "@/features/activity/utils/activity";

type AnyObj = Record<string, any>;

/* ───────── helpers – (zachované z tvojej verzie) ───────── */

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
    Number.isFinite(first?.recover_min) && first.recover_min > 0
      ? ` / ${first.recover_min}′ rec`
      : "";
  const targ = first?.target
    ? [hrToText(first.target.hr), paceToText(first.target.pace), powerToText(first.target.power)]
        .filter(Boolean)
        .join(" · ")
    : "";

  const txt = [reps && work ? `${reps}${work}` : work || reps, rec, targ].filter(Boolean).join(" ");
  return txt || null;
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

/* ───────── component ───────── */

export default function PlanActive() {
  const { planRows: rawPlanRows, rows: legacyRows } = usePlanData() as any;
  const planRows: AnyObj[] = (rawPlanRows ?? legacyRows ?? []) as AnyObj[];

  const today = todayISO();
  const limit = addDays(today, 10); // dnes..(dnes+9)

  // byDate: YYYY-MM-DD -> sessions[]
  const byDate: Record<string, AnyObj[]> = {};

  for (const row of planRows) {
    if (!row) continue;

    const dIso = String(row.plan_date ?? row.day ?? "").slice(0, 10);
    if (!dIso) continue;
    if (dIso < today || dIso >= limit) continue;

    const sess: AnyObj =
      row.payload && typeof row.payload === "object"
        ? row.payload
        : {
            sport: row.sport,
            title: row.title ?? null,
            duration_min: row.duration_min ?? null,
            intensity: row.intensity ?? null,
            session_type: row.session_type ?? null,
            notes: row.notes ?? null,
            structure: row.structure ?? null,
            exercises: row.exercises ?? null,
          };

    if (!byDate[dIso]) byDate[dIso] = [];
    byDate[dIso].push(sess);
  }

  const safeDates: string[] = Array.from({ length: 10 }, (_, i) => addDays(today, i));

  return (
    <div className="max-w-screen-lg w-full mx-auto px-3 md:px-4 lg:px-6 space-y-4">
      <section className={[CARD, "p-4 md:p-5"].join(" ")}>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-bold">Aktívny plán — Next 10 days</h2>
        </div>

        <ul className={["space-y-2", NO_X_OVERFLOW, "overflow-visible"].join(" ")}>
          {safeDates.map((iso) => {
            const sessions = byDate[iso] || [];

            if (!sessions.length) {
              return (
                <li key={`active-${iso}-empty`} className="px-0">
                  <SessionCard
                    variant="plan"
                    item={{
                      id: `active-${iso}-empty`,
                      kind: "plan",
                      title: "Žiadny tréning",
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
              const trainingDef = sessionTypeId ? findTrainingTypeById(sessionTypeId) : null;

              const title = trainingDef?.label || normTitle(it);

              const baseNotes = normNotes(it);
              const typeLine = trainingDef?.description || null;
              const combinedNotes = [typeLine, baseNotes].filter(Boolean).join(" • ");

              return (
                <li key={`active-${iso}-${sidx}`} className="px-0">
                  <SessionCard
                    variant="plan"
                    item={{
                      id: `active-${iso}-${sidx}`,
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
      </section>
    </div>
  );
}