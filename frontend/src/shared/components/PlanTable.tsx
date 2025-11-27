"use client";

import * as React from "react";
import { SURFACE_CARD, NO_X_OVERFLOW } from "@/shared/ui/classes";
import { usePlanData } from "@/shared/components/dataProviders/PlanDataProvider";
import { useActivityData } from "@/shared/components/dataProviders/ActivityDataProvider";
import ActivitySelector from "@/shared/components/ActivitySelector";
import Button from "@/shared/components/ui/Button";
import { detectSport } from "@/features/coach/utils/plan";
import { findTrainingTypeById } from "@/shared/types/training";
import { savePlanActivityLink } from "@/features/coach/api/plan";
import PlanSingle, {
  PlanStatus,
} from "@/shared/components/PlanSingle";

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

/* --- helpers (rovnaké ako v kalendári) --- */

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
          ? `CD: ${it.structure.cooldown.notes}` : null,
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

function isRestSession(row: any, sess: AnyObj): boolean {
  const sport = (row as any).sport || detectSport(sess) || "other";
  const duration = sess.duration_min ?? row.duration_min ?? null;
  const title = String(
    sess.title || sess.session_type || row.title || row.session_type || ""
  );

  if (sport === "other") return true;
  if (duration === 0) return true;
  if (/rest|volno|off day/i.test(title)) return true;
  return false;
}

/* ───────── props ───────── */

type Props = {
  dateIso: string;
};

export default function PlanTable({ dateIso }: Props) {
  const { rows: planRows } = usePlanData();
  const { rows: actRows } = useActivityData();
  const [draftLinks, setDraftLinks] = React.useState<
    Record<number, number | null>
  >({});
  const [savingId, setSavingId] = React.useState<number | null>(null);

  const inferredUserId: number | null =
    (planRows[0] as any)?.user_id ??
    (actRows[0] as any)?.user_id ??
    null;

  const todayIso = new Date().toISOString().slice(0, 10);

  const plansForDay = React.useMemo(
    () =>
      planRows.filter(
        (p: any) => String(p.plan_date).slice(0, 10) === dateIso
      ),
    [planRows, dateIso]
  );

  // odfiltrujeme rest day
  const filteredPlans = React.useMemo(
    () =>
      plansForDay.filter((p: any) => {
        const sess: AnyObj = p.payload ?? p;
        return !isRestSession(p, sess);
      }),
    [plansForDay]
  );

  const actMap = React.useMemo(() => {
    const m = new Map<number, any>();
    for (const r of actRows) {
      const id = Number((r as any).activity_id);
      if (!Number.isNaN(id)) m.set(id, r);
    }
    return m;
  }, [actRows]);

  const wrapperCls = [SURFACE_CARD, "space-y-3", "p-3 md:p-4"].join(" ");

  async function handleSaveLink(sessionId: number) {
    if (!inferredUserId) {
      console.warn("[PlanTable] missing userId, cannot save link");
      return;
    }
    const draft = draftLinks[sessionId];
    const activityId = draft == null ? null : Number(draft);

    setSavingId(sessionId);
    try {
      const res = await savePlanActivityLink(
        inferredUserId,
        sessionId,
        activityId
      );
      console.log("[PlanTable] savePlanActivityLink result", res);
      // tu si potom môžeš spraviť refetch planRows / invalidáciu cache
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className={wrapperCls}>
      <div className="flex justify-between items-center mb-1">
        <h2 className="text-lg font-bold">
          Plán &amp; stav tréningov — {prettySkDate(dateIso)}
        </h2>
      </div>

      {filteredPlans.length === 0 && (
        <p className="text-sm opacity-70">
          Pre tento deň nie je vytvorený žiadny plán.
        </p>
      )}

      {filteredPlans.length > 0 && (
        <ul className={["space-y-3", NO_X_OVERFLOW].join(" ")}>
          {filteredPlans.map((p: any) => {
            const sess: AnyObj = p.payload ?? p;
            const sport =
              (p as any).sport || detectSport(sess) || "other";

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

            const actId = p.activity_id != null ? Number(p.activity_id) : null;
            const isDone = actId != null && !Number.isNaN(actId);
            const isMissed =
              !isDone &&
              String(p.plan_date).slice(0, 10) < todayIso;
            const status: PlanStatus = isDone
              ? "done"
              : isMissed
              ? "missed"
              : "planned";

            const act = isDone ? actMap.get(actId) : null;

            const actDur = fmtRealDurationMin(
              act?.moving_time_s ?? act?.moving_time
            );
            const distStr =
              act?.distance_m != null
                ? `${(act.distance_m / 1000).toFixed(2)} km`
                : null;

            const activitySummary = isDone
              ? [act?.name || "Activity", distStr, actDur]
                  .filter(Boolean)
                  .join(" · ")
              : null;

            // správne rozlíšenie medzi “žiadny draft” a “explicitne None”
            const hasDraft = Object.prototype.hasOwnProperty.call(
              draftLinks,
              p.id
            );
            const currentDraft = hasDraft
              ? draftLinks[p.id]
              : isDone && actId != null
              ? actId
              : null;

            return (
              <li key={p.id} className="px-0">
                <PlanSingle
                  id={p.id}
                  title={title}
                  dateIso={String(p.plan_date).slice(0, 10)}
                  sport={sport}
                  status={status}
                  planDur={normDuration(sess)}
                  planIntensity={normIntensity(sess)}
                  planTarget={normTarget(sess)}
                  planNotes={combinedNotes || null}
                  activitySummary={activitySummary}
                >
                  <div className="text-xs flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
                    <span className="opacity-70">
                      Priradiť k aktivite:
                    </span>

                    <div className="flex-1 max-w-xs">
                      <ActivitySelector
                        userId={inferredUserId}
                        dateIso={dateIso}
                        sports={[sport]}
                        deltaDays={2}
                        value={currentDraft == null ? "" : currentDraft}
                        onChange={(id) => {
                          setDraftLinks((prev) => ({
                            ...prev,
                            [p.id]: id === "" ? null : Number(id),
                          }));
                        }}
                        onPicked={() => {
                          /* len update labelu */
                        }}
                        variant="compact"
                      />
                    </div>

                    <Button
                      variant="primary"
                      size="xs"
                      disabled={
                        !inferredUserId || savingId === p.id
                      }
                      onClick={() => handleSaveLink(p.id)}
                    >
                      {savingId === p.id ? "Ukladám…" : "Uložiť"}
                    </Button>
                  </div>
                </PlanSingle>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}