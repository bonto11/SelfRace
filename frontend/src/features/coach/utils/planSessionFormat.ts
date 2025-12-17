// src/features/coach/utils/planSessionFormat.ts
export type AnyObj = Record<string, any>;

export function hrToText(hr?: any): string | null {
  if (!hr) return null;
  if (Array.isArray(hr) && hr.length === 2 && hr.every((x) => Number.isFinite(x))) {
    return `HR ${hr[0]}–${hr[1]}`;
  }
  return null;
}
export function paceToText(p?: any): string | null {
  return typeof p === "string" && p.trim() ? `pace ${p}` : null;
}
export function powerToText(w?: any): string | null {
  return Number.isFinite(w) ? `power ${w}W` : null;
}

export function normTarget(it: AnyObj): string | null {
  const hr   = it?.target_hr_bpm_range ?? it?.target_hr ?? null;
  const pace = it?.target_pace_min_per_km ?? null;
  const pow  = it?.target_power_watts ?? null;

  const mainT = Array.isArray(it?.structure?.main)
    ? it.structure.main[0]?.target
    : it?.structure?.main?.target;

  const hr2   = hr   ?? mainT?.hr ?? mainT?.heart_rate ?? null;
  const pace2 = pace ?? mainT?.pace ?? null;
  const pow2  = pow  ?? mainT?.power ?? null;

  const parts = [hrToText(hr2), paceToText(pace2), powerToText(pow2)].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export function intervalsToText(main: any): string | null {
  const arr =
    Array.isArray(main) ? main :
    (main && Array.isArray(main.sets) ? main.sets : null);
  if (!arr || !arr.length) return null;

  const first = arr[0];
  const reps = Number.isFinite(first?.reps) ? `${first.reps}×` : "";
  const work = Number.isFinite(first?.work_min) ? `${first.work_min}′` : "";
  const rec  =
    Number.isFinite(first?.recover_min) && first.recover_min > 0
      ? ` / ${first.recover_min}′ rec`
      : "";
  const targ = first?.target
    ? [hrToText(first.target.hr), paceToText(first.target.pace), powerToText(first.target.power)]
        .filter(Boolean).join(" · ")
    : "";

  const txt = [reps && work ? `${reps}${work}` : work || reps, rec, targ]
    .filter(Boolean).join(" ");
  return txt || null;
}

export function normTitle(it: AnyObj) {
  return it?.title ?? it?.name ?? "Session";
}
export function normDuration(it: AnyObj) {
  const minutes =
    (typeof it?.duration_min === "number" && it.duration_min) ??
    (typeof it?.dur === "number" && it.dur) ?? null;
  return minutes != null ? `${minutes} min` : null;
}
export function normIntensity(it: AnyObj) {
  return it?.intensity ?? null;
}

export function normNotes(it: AnyObj) {
  if (it?.notes) return it.notes;

  const wu = it?.structure?.warmup
    ? [
        it.structure.warmup?.notes ? `WU: ${it.structure.warmup.notes}` : null,
        hrToText(it.structure.warmup?.target?.hr),
        paceToText(it.structure.warmup?.target?.pace),
        powerToText(it.structure.warmup?.target?.power),
      ].filter(Boolean).join(" · ")
    : "";

  const main = it?.structure?.main ? intervalsToText(it.structure.main) : "";

  const cd = it?.structure?.cooldown
    ? [
        it.structure.cooldown?.notes ? `CD: ${it.structure.cooldown.notes}` : null,
        hrToText(it.structure.cooldown?.target?.hr),
        paceToText(it.structure.cooldown?.target?.pace),
        powerToText(it.structure.cooldown?.target?.power),
      ].filter(Boolean).join(" · ")
    : "";

  const ex = Array.isArray(it?.exercises) && it.exercises.length
    ? "Exercises: " +
      it.exercises.map((e: any) => {
        const parts = [e?.name, e?.sets ? `${e.sets}x` : ""];
        if (e?.seconds) parts.push(`${e.seconds}s`);
        else if (e?.reps) parts.push(`${e.reps}`);
        return parts.filter(Boolean).join(" ");
      }).join(", ")
    : "";

  const parts = [wu, main, cd, ex].filter(Boolean);
  return parts.length ? parts.join(" • ") : null;
}