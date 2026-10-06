"use client";

/*
 * Trend regenerácie – pripraví dennú mriežku z recovery záznamov
 * (bežný priemer, chýbajúce dni, faktory, poznámky) a vykreslí ju
 * spoločnou kartou TrendCard.
 */

import { useMemo } from "react";

import { useRecoveryData } from "@/app/shared/components/dataProviders/RecoveryDataProvider";
import type { RecoveryRow } from "@/app/features/recovery/types/recovery";
import { rollingMean } from "@/app/shared/utils/recovery";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import TrendCard, {
  historyDates,
  type TrendPoint,
  type TrendSeries,
  type TrendSpec,
} from "@/app/shared/charts/TrendCard";

export type TrendBand =
  | { kind: "rolling"; pct: number } // bežný priemer (14 dní) ± pct
  | { kind: "fixed"; lo: number; hi: number }; // odporúčané pásmo

export type RecoveryTrendSpec = {
  title: string;
  subtitle: string;
  mainLabel: string;
  /** druhá séria (HRV max) – len keď je zapnuté „Zobraziť detaily“ */
  altLabel?: string;
  value: (r: RecoveryRow) => number; // NaN = chýba
  altValue?: (r: RecoveryRow) => number;
  band: TrendBand;
  bandLabel: string;
  bandTexts?: { below: string; inside: string; above: string };
  fmt: (v: number) => string;
  /** bez jednotky – do dlaždíc štatistík */
  fmtStat: (v: number) => string;
  fmtDelta: (d: number) => string;
  axisFmt: (v: number) => string;
  yStep: number;
};

const BASELINE_DAYS = 14;
/** najmenšia história – aby sa dalo listovať aj pri pár záznamoch */
const MIN_HISTORY_DAYS = 12 * 7;

function interpolateMissing(vals: number[]): (number | null)[] {
  const n = vals.length;
  const out = new Array<number | null>(n).fill(null);
  const nxt = new Array<number>(n).fill(-1);
  let last = -1;
  for (let i = n - 1; i >= 0; i--) {
    if (Number.isFinite(vals[i])) last = i;
    nxt[i] = last;
  }
  let prev = -1;
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(vals[i])) {
      prev = i;
      continue;
    }
    const nx = nxt[i];
    if (prev !== -1 && nx !== -1) out[i] = vals[prev] + (vals[nx] - vals[prev]) * ((i - prev) / (nx - prev));
    else if (prev !== -1) out[i] = vals[prev];
    else if (nx !== -1) out[i] = vals[nx];
  }
  return out;
}

export default function RecoveryTrend({ spec, showAlt = false }: { spec: RecoveryTrendSpec; showAlt?: boolean }) {
  const { rows } = useRecoveryData();

  const points = useMemo<TrendPoint[]>(() => {
    const byDate = new Map<string, RecoveryRow>();
    let earliest: string | null = null;
    for (const r of rows) {
      byDate.set(r.date, r);
      if (!earliest || r.date < earliest) earliest = r.date;
    }

    // bežný priemer potrebuje históriu aj pred prvým zobrazeným dňom
    const lead = spec.band.kind === "rolling" ? BASELINE_DAYS : 0;
    const allDates = historyDates(earliest, MIN_HISTORY_DAYS, 400, lead);
    const allVals = allDates.map((d) => {
      const r = byDate.get(d);
      return r ? spec.value(r) : NaN;
    });
    const baseAll =
      spec.band.kind === "rolling"
        ? rollingMean(allVals.map((v) => (Number.isFinite(v) ? v : null)), BASELINE_DAYS)
        : allDates.map(() => null);

    const dates = allDates.slice(lead);
    const vals = allVals.slice(lead);
    const base = baseAll.slice(lead);
    const missing = interpolateMissing(vals);

    return dates.map((d, i) => {
      const r = byDate.get(d);
      const v = vals[i];
      const miss = !Number.isFinite(v);
      const a = showAlt && r && spec.altValue ? spec.altValue(r) : NaN;
      let band: [number, number] | null = null;
      if (spec.band.kind === "fixed") band = [spec.band.lo, spec.band.hi];
      else if (base[i] != null) {
        const b = base[i] as number;
        band = [b * (1 - spec.band.pct), b * (1 + spec.band.pct)];
      }
      const hasAlcohol = !!r?.alcohol_consumed;
      const hasFood = !!r?.food_2h_before;
      const hasCaffeine = !!r?.caffeine_8h;
      return {
        date: d,
        val: miss ? null : v,
        alt: Number.isFinite(a) ? a : null,
        band,
        base: base[i] ?? null,
        missingY: miss ? missing[i] : null,
        comments: r?.comments,
        hasAlcohol,
        hasFood,
        hasCaffeine,
        eventsY: hasAlcohol || hasFood || hasCaffeine ? (miss ? missing[i] : v) : null,
        noteY: r?.comments?.trim() ? (miss ? missing[i] : v) : null,
      };
    });
  }, [rows, spec, showAlt]);

  const cardSpec = useMemo<TrendSpec>(() => {
    const series: TrendSeries[] = [{ key: "val", label: spec.mainLabel, color: appColors.chartRecoveryMain }];
    if (spec.altLabel) series.push({ key: "alt", label: spec.altLabel, color: appColors.chartRecoveryAlt, dashed: true });
    return {
      title: spec.title,
      subtitle: spec.subtitle,
      series,
      bandLabel: spec.bandLabel,
      context: spec.band.kind === "rolling" ? "baseline" : "band",
      bandTexts: spec.bandTexts,
      fmt: spec.fmt,
      fmtStat: spec.fmtStat,
      fmtDelta: spec.fmtDelta,
      axisFmt: spec.axisFmt,
      yStep: spec.yStep,
    };
  }, [spec]);

  return <TrendCard spec={cardSpec} points={points} />;
}
