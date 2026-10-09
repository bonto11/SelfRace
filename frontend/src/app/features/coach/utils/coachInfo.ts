/*
 * Text pod „i“ pre coach widgety AJ ich detail – rovnaký na oboch miestach
 * (vzor activityInfo). Widget je strohý; čo ukazuje, ako ho čítať a čo to
 * znamená pre usera, je tu.
 */
import type { useT } from "@/app/shared/i18n/useT";
import type { Level } from "@/app/shared/ui/widget/WidgetParts";

type T = ReturnType<typeof useT>;

export type CoachInfoKey =
  | "race"
  | "daily"
  | "advisor"
  | "weekly"
  | "athleteState"
  | "progress"
  | "planSummary"
  | "compliance"
  | "notes"
  | "health"
  | "external"
  | "prefs";

export function coachInfo(t: T, key: CoachInfoKey): string {
  return t(`coachWidgets.info.${key}` as any);
}

/** prvý neprázdny text zo zoznamu AI bodov */
export function firstText(v: unknown): string | null {
  if (!Array.isArray(v)) return null;
  const s = v.find((x) => typeof x === "string" && x.trim());
  return typeof s === "string" ? s.trim() : null;
}

export function levelLabel(t: T, l: Level | null): string {
  return l ? t(`common.levels.${l}` as any) : "—";
}

/** fáza z plánu (base_aerobic, taper…) – neznámu fázu radšej vynechaj, než ukázať enum */
export function phaseLabel(t: T, phase: string | null): string | undefined {
  if (!phase) return undefined;
  const key = `common.phases.${phase.toLowerCase().replace(/ /g, "_")}`;
  const v = t(key as any);
  return v === key ? undefined : v;
}

/** 45 → „45 min“, 130 → „2 h 10“ */
export function fmtMinutes(min: number): string {
  const m = Math.round(min || 0);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, "0")}` : `${h} h`;
}
