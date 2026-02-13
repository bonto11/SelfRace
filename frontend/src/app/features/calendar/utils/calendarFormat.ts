import { detectSport } from "@/app/features/coach/utils/plan";
import type{ PlanStatus } from "@/app/features/calendar/types/calendarTypes";
import { useT } from "@/app/shared/i18n/useT";

type AnyObj = Record<string, any>;

function hrToText(hr?: any): string | null {
  const t = useT();
  if (!hr) return null;
  if (Array.isArray(hr) && hr.length === 2 && hr.every((x) => Number.isFinite(x))) {
    return `${t("common.metrics.hr")} ${hr[0]}–${hr[1]}`;
  }
  return null;
}
function paceToText(p?: any): string | null {
  const t = useT();
  return typeof p === "string" && p.trim() ? `${t("common.metrics.pace")} ${p}` : null;
}
function powerToText(w?: any): string | null {
  const t = useT();
  return Number.isFinite(w) ? `${t("common.metrics.power")} ${w} ${t("common.units.power")}` : null;
}

export function normTarget(it: AnyObj): string | null {
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
    ? [hrToText(first.target.hr), paceToText(first.target.pace), powerToText(first.target.power)]
        .filter(Boolean)
        .join(" · ")
    : "";

  const txt = [reps && work ? `${reps}${work}` : work || reps, rec, targ]
    .filter(Boolean)
    .join(" ");

  return txt || null;
}

export function normTitle(it: AnyObj) {
    const t = useT();
  return it?.title ?? it?.name ?? t("calendar.session");
}
export function normDuration(it: AnyObj) {
   const t = useT();
  const minutes =
    (typeof it?.duration_min === "number" && it.duration_min) ??
    (typeof it?.dur === "number" && it.dur) ??
    null;
  return minutes != null ? `${minutes} ${t("common.units.min")}` : null;
}
export function normIntensity(it: AnyObj) {
  return it?.intensity ?? null;
}

export function normNotes(it: AnyObj) {
  const t = useT();
  if (it?.notes) return it.notes;

  const wu = it?.structure?.warmup
    ? [
        it.structure.warmup?.notes ? `${t("coach.wu")}: ${it.structure.warmup.notes}` : null,
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
        it.structure.cooldown?.notes ? `${t("coach.wu")}: ${it.structure.cooldown.notes}` : null,
        hrToText(it.structure.cooldown?.target?.hr),
        paceToText(it.structure.cooldown?.target?.pace),
        powerToText(it.structure.cooldown?.target?.power),
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const ex =
    Array.isArray(it?.exercises) && it.exercises.length
      ? `${t("coach.exercises")} : ` +
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

export function fmtRealDurationMin(seconds?: number | null): string | null {
  const t = useT();
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return null;
  const mins = Math.round(seconds / 60);
  return `${mins} ${t("common.units.min")}`;
}

export function isRestSession(row: any, sess: AnyObj): boolean {
  const sport = (row as any).sport || detectSport(sess) || "other";
  const duration = sess.duration_min ?? row.duration_min ?? null;
  const title = String(sess.title || sess.session_type || row.title || row.session_type || "");

  if (sport === "other") return true;
  if (duration === 0) return true;
  if (/rest|volno|off day/i.test(title)) return true;
  return false;
}

export function planStatusForDate(dIso: string, todayIso: string, actId: number | null): PlanStatus {
  if (actId) return "done";
  return dIso < todayIso ? "missed" : "planned";
}