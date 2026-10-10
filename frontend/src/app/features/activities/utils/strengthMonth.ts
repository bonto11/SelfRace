import { appLocale } from "@/app/shared/i18n/locale";
import type { StrengthMonthExercise } from "@/app/features/activities/api/monthly_summary";

/** najlepší výkon v cviku za mesiac: váha (× opakovania), inak opakovania / sekundy / metre */
export function exerciseBest(ex: StrengthMonthExercise, repsUnit: string): string {
  const n = (v: number) => v.toLocaleString(appLocale(), { maximumFractionDigits: 1 });
  if (ex.best_weight_kg) return `${n(ex.best_weight_kg)} kg${ex.reps_at_best ? ` × ${ex.reps_at_best}` : ""}`;
  if (ex.max_reps == null) return "";
  if (ex.measure === "time") return `${ex.max_reps} s`;
  if (ex.measure === "distance") return `${ex.max_reps} m`;
  return `${ex.max_reps} ${repsUnit}`;
}
