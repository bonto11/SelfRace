"use client";

import * as React from "react";
import { CARD, NO_X_OVERFLOW } from "@/shared/ui/classes";
import { usePlanData } from "@/shared/components/dataProviders/PlanDataProvider";
import { useActivityData } from "@/shared/components/dataProviders/ActivityDataProvider";
import ActivitySingle from "@/shared/components/ActivitySingle";
import ActivitySelector from "@/shared/components/ActivitySelector";
import { detectSport } from "@/features/coach/utils/plan";
import { findTrainingTypeById } from "@/shared/types/training";

/* helpers – rovnaké ako v ActivitiesCalendar */

type AnyObj = Record<string, any>;

function prettySkDate(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const wk = d.toLocaleDateString("sk-SK", { weekday: "short" });
  return `${wk} · ${day}`;
}

function hrToText(hr?: any): string | null {
  if (!hr) return null;
  if (
    Array.isArray(hr) &&
    hr.length === 2 &&
    hr.every((x) => Number.isFinite(x))
  ) {
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

  const parts = [hrToText(hr2), paceToText(pace2), powerToText(pow2)].filter(
    Boolean
  );
  return parts.length ? parts.join(" · ") : null;
}

function intervalsToText(main: any): string | null {
  const arr = Array.isArray(main)
    ? main
    : main && Array.isArray(main.sets)
    ? main.sets
    : null;
  if (!arr || !arr.length) return null;

  const first = arr[0];
  const reps = Number.isFinite(first?.reps) ? `${first.reps}×` : "";
  const work = Number.isFinite(first?.work_min) ? `${first.work_min}′` : "";
  const rec =
    Number.isFinite(first?.recover_min) && first.recover_min > 0
      ? ` / ${first.recover_min}′ rec`
      : "";
  const targ = first?.target
    ? [
        hrToText(first.target.hr),
        paceToText(first.target.pace),
        powerToText(first.target.power),
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const txt = [reps && work ? `${reps}${work}` : work || reps, rec, targ]
    .filter(Boolean)
    .join(" ");
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
        it.structure.cooldown?.notes
          ? `CD: ${it.structure.cooldown.notes}`
          : null,
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

function fmtRealDurationMin(seconds?: number | null): string | null {
  if (
    typeof seconds !== "number" ||
    !Number.isFinite(seconds) ||
    seconds <= 0
  ) {
    return null;
  }
  const mins = Math.round(seconds / 60);
  return `${mins} min`;
}

/* ───────── props ───────── */

type Props = {
  dateIso: string;
  onFocusActivity?: (activityId: number) => void;
  enableLinkSelector?: boolean;
};

export default function PlanTable({
  dateIso,
  onFocusActivity,
  enableLinkSelector = true,
}: Props) {
  const { rows: planRows } = usePlanData();
  const { rows: actRows } = useActivityData();
  const [draftLinks, setDraftLinks] = React.useState<
    Record<number, number | null>
  >({});

  const inferredUserId: number | null =
    (planRows[0] as any)?.user_id ??
    (actRows[0] as any)?.user_id ??
    null;

  const plansForDay = React.useMemo(
    () =>
      planRows.filter(
        (p: any) => String(p.plan_date).slice(0, 10) === dateIso
      ),
    [planRows, dateIso]
  );

  const planned = plansForDay.filter(
    (p: any) => p.activity_id == null || Number.isNaN(Number(p.activity_id))
  );
  const done = plansForDay.filter(
    (p: any) => p.activity_id != null && !Number.isNaN(Number(p.activity_id))
  );

  const activitiesForDay = React.useMemo(
    () => actRows.filter((r) => r.date.slice(0, 10) === dateIso),
    [actRows, dateIso]
  );

  const actMap = React.useMemo(() => {
    const m = new Map<number, any>();
    for (const r of actRows) {
      const id = Number((r as any).activity_id);
      if (!Number.isNaN(id)) m.set(id, r);
    }
    return m;
  }, [actRows]);

  const wrapperCls = [CARD, "space-y-3", "p-3 md:p-4"].join(" ");

  return (
    <div className={wrapperCls}>
      <div className="flex justify-between items-center mb-1">
        <h2 className="text-lg font-bold">
          Plán &amp; stav tréningov — {prettySkDate(dateIso)}
        </h2>
      </div>

      {done.length === 0 && planned.length === 0 && (
        <p className="text-sm opacity-70">
          Pre tento deň nie je vytvorený žiadny plán.
        </p>
      )}

      {done.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wide opacity-70">
            Splnené z plánu
          </div>
          <ul className={["space-y-3", NO_X_OVERFLOW].join(" ")}>
            {done.map((p: any) => {
              const sess: AnyObj = p.payload ?? p;
              const actId = Number(p.activity_id);
              const act = !Number.isNaN(actId) ? actMap.get(actId) : null;

              const sport =
                (p as any).sport || detectSport(sess) || "other";

              const title = normTitle(sess);
              const planDur = normDuration(sess);

              const actDur = fmtRealDurationMin(
                act?.moving_time_s ?? act?.moving_time
              );

              const handleClick = () => {
                if (onFocusActivity && !Number.isNaN(actId)) {
                  onFocusActivity(actId);
                }
              };

              const distanceStr =
                act?.distance_m != null
                  ? `${(act.distance_m / 1000).toFixed(2)} km`
                  : null;

              return (
                <li key={`done-${p.id}`} className="px-0">
                  {/* karta aktivity – rovnaké farby/styl ako v ActivityTable */}
                  {act && (
                    <button
                      type="button"
                      onClick={handleClick}
                      className="w-full text-left"
                    >
                      <ActivitySingle
                        variant="calendar"
                        data={{
                          id: act.activity_id,
                          name: act.name || "Activity",
                          dateIso,
                          sport,
                          timeStr: actDur,
                          distanceStr,
                          avgHr: act.average_heartrate_bpm ?? null,
                          maxHr: act.max_heartrate_bpm ?? null,
                          activityId: act.activity_id,
                          singleDayContext: true,
                          // prípadne sem vieš neskôr doplniť extra badge „z plánu“
                        }}
                        defaultOpen={false}
                      />
                    </button>
                  )}

                  {/* info o pláne pod kartou – zarovnané doľava */}
                  <div className="mt-1 pl-1 text-xs opacity-80 space-y-0.5">
                    <div>
                      <span className="inline-flex items-center justify-center rounded-full border border-emerald-500/80 text-[10px] px-1.5 py-0.5 text-emerald-300 mr-2">
                        ✓ hotovo
                      </span>
                      Plán: {title}
                      {planDur && ` · ${planDur}`}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {planned.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wide opacity-70">
            Plánované tréningy
          </div>

          <ul className={["space-y-3", NO_X_OVERFLOW].join(" ")}>
            {planned.map((p: any) => {
              const sess: AnyObj = p.payload ?? p;
              const sessionTypeId =
                typeof sess?.session_type === "string"
                  ? sess.session_type
                  : typeof p.session_type === "string"
                  ? p.session_type
                  : null;

              const trainingDef = sessionTypeId
                ? findTrainingTypeById(sessionTypeId)
                : null;

              const title =
                trainingDef?.label || normTitle(sess) || "Tréning";

              const baseNotes = normNotes(sess);
              const typeLine = trainingDef?.description || null;
              const combinedNotes = [typeLine, baseNotes]
                .filter(Boolean)
                .join(" • ");

              const sport =
                (p as any).sport || detectSport(sess) || "other";

              const currentDraft = draftLinks[p.id] ?? null;

              return (
                <li key={p.id} className="px-0 space-y-1.5">
                  <ActivitySingle
                    variant="plan"
                    data={{
                      id: `plan-${p.id}`,
                      name: title,
                      dateIso: String(p.plan_date).slice(0, 10),
                      sport: sport as any,
                      planDur: normDuration(sess),
                      planIntensity: normIntensity(sess),
                      planTarget: normTarget(sess),
                      planNotes: combinedNotes || null,
                      planRaw: sess,
                      planStructure: sess?.structure ?? null,
                      planExercises: sess?.exercises ?? null,
                    }}
                    defaultOpen={false}
                  />

                  {enableLinkSelector && (
                    <div className="pl-2 text-xs flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
                      <span className="opacity-70">
                        Priradiť k aktivite:
                      </span>
                      <ActivitySelector
                        userId={inferredUserId}
                        dateIso={dateIso}
                        sports={[sport]}
                        deltaDays={1}
                        value={currentDraft ?? ""}
                        onChange={(id) => {
                          setDraftLinks((prev) => ({
                            ...prev,
                            [p.id]: id === "" ? null : Number(id),
                          }));
                          // TODO: tu potom zavoláš nové API na uloženie mapovania
                        }}
                        onPicked={() => {
                          /* nateraz nič */
                        }}
                        className="mt-1 max-w-xs"
                        // variant compact ak si ho doplníš
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}