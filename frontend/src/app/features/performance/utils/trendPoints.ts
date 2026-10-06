import { historyDates, type TrendPoint, type TrendZone } from "@/app/shared/charts/TrendCard";
import { levelLabel } from "@/app/features/performance/utils/performance";

/** najmenšia história – aby sa dalo listovať aj pri pár meraniach */
const MIN_HISTORY_DAYS = 12 * 7;

/**
 * Riedke merania (váha, tuk, VO₂max, zóny) → denná mriežka pre TrendCard.
 * Dni bez merania majú null, čiara ich spojí. Viac meraní v jeden deň =
 * platí posledné.
 */
export function dailyPoints<R>(
  rows: R[],
  dateOf: (r: R) => string | null | undefined,
  values: (r: R) => Record<string, number | null | undefined>,
): TrendPoint[] {
  const byDate = new Map<string, Record<string, number | null>>();
  let earliest: string | null = null;
  const sorted = [...rows]
    .filter((r) => !!dateOf(r))
    .sort((a, b) => String(dateOf(a)).localeCompare(String(dateOf(b))));
  for (const r of sorted) {
    const d = String(dateOf(r)).slice(0, 10);
    const v = values(r);
    const clean: Record<string, number | null> = {};
    for (const [k, x] of Object.entries(v)) clean[k] = typeof x === "number" && Number.isFinite(x) ? x : null;
    byDate.set(d, { ...(byDate.get(d) ?? {}), ...clean });
    if (!earliest || d < earliest) earliest = d;
  }
  return historyDates(earliest, MIN_HISTORY_DAYS).map((date) => ({ date, ...(byDate.get(date) ?? {}) }));
}

/** referenčné pásma (min/max) → pevné pásma grafu */
export function rangesToZones(
  t: any,
  ranges: { label?: string; min: number | null; max: number | null }[],
  colorFor: (label: string) => string,
): TrendZone[] {
  // pásma na seba nadväzujú (koniec = začiatok ďalšieho) – v referenčných
  // tabuľkách sú medzery typu 13,9 → 14, hodnota 13,95 by nepatrila nikam
  return ranges.map((r, i) => ({
    from: r.min ?? ranges[i - 1]?.max ?? 0,
    to: ranges[i + 1]?.min ?? r.max ?? 1000,
    label: levelLabel(t, r.label || ""),
    color: colorFor(r.label || ""),
  }));
}

/** sekundy → „1:42:05“ alebo „21:30“ */
export function fmtDuration(sec: number): string {
  const s = Math.round(Math.abs(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** os pre časy pretekov – pri hodinách stačí h:mm */
export function fmtDurationAxis(sec: number): string {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}` : `${m}:${String(s % 60).padStart(2, "0")}`;
}
