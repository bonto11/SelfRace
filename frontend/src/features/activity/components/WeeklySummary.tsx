"use client";

import { useMemo } from "react";
import { THEME } from "@/shared/theme/tokens";

/**
 * Vstupné dáta – rovnaké polia, aké posiela TrendWeeklyLoad.
 * Ak by si mal navyše polia, nevadí.
 */
export type WeekRow = {
  week: string; label: string; start: string; end: string;
  km_run: number; km_ride: number; km_mixed: number; km_skate: number;
  time_run_min: number; time_ride_min: number; time_strength_min: number;
  time_mixed_min: number; time_skate_min: number; time_other_min: number;
  trimp_run: number; trimp_ride: number; trimp_strength: number;
  trimp_mixed: number; trimp_skate: number; trimp_other: number;
  monotony?: { km?: number; time?: number; trimp?: number };
  strain?:    { km?: number; time?: number; trimp?: number };
};

type Metric = "km" | "time" | "trimp";

type Props = {
  weeks: WeekRow[];
  metric: Metric;
  /** identifikátor týždňa – posielame `week || label || start` */
  selectedWeek: string;
};

function fmtKm(v: number)   { return `${(v || 0).toFixed(1)} km`; }
function fmtMin(v: number)  { return `${Math.round(v || 0)} min`; }
function fmtTrimp(v: number){ return `${Math.round(v || 0)} TRIMP`; }

export default function WeeklySummary({ weeks, metric, selectedWeek }: Props) {
  // nájdi týždeň podľa viacerých kľúčov (robustné)
  const w = useMemo(() => {
    const i = weeks.findIndex(
      (x) => x.week === selectedWeek || x.label === selectedWeek || x.start === selectedWeek
    );
    return i >= 0 ? weeks[i] : null;
  }, [weeks, selectedWeek]);

  if (!w) {
    return (
      <div className="mt-3 text-sm opacity-70">
        Nenašiel sa týždeň <code>{selectedWeek}</code>.
      </div>
    );
  }

  // Výpočty podľa zvolenej metriky
  const rows = useMemo(() => {
    if (metric === "km") {
      const total = (w.km_run + w.km_ride + w.km_mixed + w.km_skate);
      return {
        title: "Kilometre (súčet)",
        totalLabel: fmtKm(total),
        breakdown: [
          ["Run",    fmtKm(w.km_run)],
          ["Ride",   fmtKm(w.km_ride)],
          ["Mixed",  fmtKm(w.km_mixed)],
          ["Skate",  fmtKm(w.km_skate)],
        ],
        mono: w.monotony?.km ?? null,
        strain: w.strain?.km ?? null,
      };
    }
    if (metric === "time") {
      const total =
        w.time_run_min + w.time_ride_min + w.time_strength_min +
        w.time_mixed_min + w.time_skate_min + w.time_other_min;
      return {
        title: "Čas (súčet)",
        totalLabel: fmtMin(total),
        breakdown: [
          ["Run",      fmtMin(w.time_run_min)],
          ["Ride",     fmtMin(w.time_ride_min)],
          ["Strength", fmtMin(w.time_strength_min)],
          ["Mixed",    fmtMin(w.time_mixed_min)],
          ["Skate",    fmtMin(w.time_skate_min)],
          ["Other",    fmtMin(w.time_other_min)],
        ],
        mono: w.monotony?.time ?? null,
        strain: w.strain?.time ?? null,
      };
    }
    // trimp
    const total =
      w.trimp_run + w.trimp_ride + w.trimp_strength +
      w.trimp_mixed + w.trimp_skate + w.trimp_other;
    return {
      title: "TRIMP (súčet)",
      totalLabel: fmtTrimp(total),
      breakdown: [
        ["Run",      fmtTrimp(w.trimp_run)],
        ["Ride",     fmtTrimp(w.trimp_ride)],
        ["Strength", fmtTrimp(w.trimp_strength)],
        ["Mixed",    fmtTrimp(w.trimp_mixed)],
        ["Skate",    fmtTrimp(w.trimp_skate)],
        ["Other",    fmtTrimp(w.trimp_other)],
      ],
      mono: w.monotony?.trimp ?? null,
      strain: w.strain?.trimp ?? null,
    };
  }, [metric, w]);

  return (
    <div className="mt-3 rounded-md border border-neutral-800 bg-neutral-900 p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold">
          Týždeň: {w.label || w.week}{" "}
          <span className="opacity-70">({w.start} – {w.end})</span>
        </div>
        <div className="opacity-90">{rows.title}: <strong>{rows.totalLabel}</strong></div>
      </div>

      <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
        {rows.breakdown.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between border-b border-neutral-800/60 py-1">
            <span className="opacity-80">{k}</span>
            <span className="font-medium">{v}</span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-4 opacity-90">
        <div style={{ color: THEME.chart.monotony }}>
          Monotony: <strong>{rows.mono == null ? "—" : rows.mono.toFixed(2)}</strong>
        </div>
        <div style={{ color: THEME.chart.strain }}>
          Strain: <strong>{rows.strain == null ? "—" : Math.round(rows.strain)}</strong>
        </div>
      </div>
    </div>
  );
}