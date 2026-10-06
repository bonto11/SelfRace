/*
 * Spoločné formáty a texty pod „i“ pre performance widgety (vzor coachInfo).
 */
import type { useT } from "@/app/shared/i18n/useT";
import type { Tone } from "@/app/shared/ui/widget/WidgetParts";
import { CHART_HR } from "@/app/shared/ui/tokens/charts";

type T = ReturnType<typeof useT>;

export type PerformanceInfoKey =
  | "estTopPaces"
  | "pb"
  | "zonesHR"
  | "zonesPaces"
  | "vo2max"
  | "bodyWeight"
  | "bodyFat"
  | "bodyScan";

export function performanceInfo(t: T, key: PerformanceInfoKey): string {
  return t(`performanceWidgets.info.${key}` as any);
}

/** 1 desatinné miesto s čiarkou/bodkou podľa jazyka */
export function fmt1(v: number | null | undefined, locale: string): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** čas pretekov M:SS / H:MM:SS */
export function fmtRaceTime(sec?: number | null): string {
  if (!sec || !Number.isFinite(sec)) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

/** tempo mm:ss (bez „/km“ – jednotku dáva widget) */
export function fmtPace(secPerKm?: number | null): string {
  if (!secPerKm || secPerKm <= 0) return "—";
  const total = Math.round(secPerKm);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function fmtShortDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(locale, { day: "numeric", month: "numeric", year: "2-digit" });
}

/** merania trendu {measured_at, value_num} → body s dátumom pre Sparkline */
export function trendPoints(rows: any[] | null | undefined): { date: string; value: number }[] {
  return (rows ?? [])
    .map((r) => ({ date: String(r?.measured_at ?? "").slice(0, 10), value: Number(r?.value_num ?? r?.value) }))
    .filter((p) => p.date && Number.isFinite(p.value))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** úroveň z referenčných tabuliek (VO2max, tuk) → tón štítku */
export function levelTone(labelRaw: string | null | undefined): Tone {
  const l = String(labelRaw ?? "").toLowerCase();
  if (/excellent|elite|superior|good|athlete|fitness/.test(l)) return "good";
  if (/average/.test(l)) return "info";
  // essential = tuku je príliš málo – rovnako nežiaduce ako veľa, ale menej časté
  if (/fair|essential/.test(l)) return "warn";
  if (/poor|obese/.test(l)) return "danger";
  return "neutral";
}

/** preložený názov úrovne; neznámy ponechá ako je */
export function levelText(t: T, labelRaw: string): string {
  const key = `common.levels.${labelRaw.trim().toLowerCase()}`;
  const v = t(key as any);
  return v === key ? labelRaw.trim() : v;
}

/** farby zón Z1–Z5 – rovnaké ako v grafoch tepu */
export const ZONE_COLORS = [
  CHART_HR.colors.z1,
  CHART_HR.colors.z2,
  CHART_HR.colors.z3,
  CHART_HR.colors.z4,
  CHART_HR.colors.z5,
];
