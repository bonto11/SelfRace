// src/features/activity/components/WeeklySummary.tsx
"use client";

import { useMemo } from "react";
import { SUBCARD } from "@/app/shared/ui/classes";
import { THEME } from "@/app/shared/theme/tokens";
import { WeekRow } from "@/app/features/activities/types/WeeklyLoad";
import { Metric } from "@/app/features/activities/types/activities";

type Props = {
  weeks: WeekRow[];
  metric: Metric;
  /** identifikátor týždňa – posielame `week || label || start` */
  selectedWeek: string;
};

function fmtKm(v: number) {
  return `${(Number(v) || 0).toFixed(1)} km`;
}
function fmtMin(v: number) {
  return `${Math.round(Number(v) || 0)} min`;
}
function fmtTrimp(v: number) {
  return `${Math.round(Number(v) || 0)} TRIMP`;
}

export default function WeeklySummary({ weeks, metric, selectedWeek }: Props) {
  // nájdi týždeň robustne podľa viacerých kľúčov
  const w = useMemo(() => {
    if (!Array.isArray(weeks) || !weeks.length) return null;
    const i = weeks.findIndex(
      (x) =>
        x.week === selectedWeek ||
        x.label === selectedWeek ||
        x.start === selectedWeek
    );
    return i >= 0 ? weeks[i] : null;
  }, [weeks, selectedWeek]);

  if (!w) {
    return (
      <div className={`${SUBCARD} mt-3 p-3 text-sm opacity-70`}>
        Nenašiel sa týždeň <code>{selectedWeek}</code>.
      </div>
    );
  }

  // Výpočty podľa zvolenej metriky
  const rows = useMemo(() => {
    if (metric === "km") {
      const total =
        (w.km_run || 0) +
        (w.km_ride || 0) +
        (w.km_mixed || 0) +
        (w.km_skate || 0);
      return {
        title: "Kilometre (súčet)",
        totalLabel: fmtKm(total),
        breakdown: [
          ["Run", fmtKm(w.km_run)],
          ["Ride", fmtKm(w.km_ride)],
          ["Mixed", fmtKm(w.km_mixed)],
          ["Skate", fmtKm(w.km_skate)],
        ] as const,
        mono: w.monotony?.km ?? null,
        strain: w.strain?.km ?? null,
      };
    }
    if (metric === "time") {
      const total =
        (w.time_run_min || 0) +
        (w.time_ride_min || 0) +
        (w.time_strength_min || 0) +
        (w.time_mixed_min || 0) +
        (w.time_skate_min || 0) +
        (w.time_other_min || 0);
      return {
        title: "Čas (súčet)",
        totalLabel: fmtMin(total),
        breakdown: [
          ["Run", fmtMin(w.time_run_min)],
          ["Ride", fmtMin(w.time_ride_min)],
          ["Strength", fmtMin(w.time_strength_min)],
          ["Mixed", fmtMin(w.time_mixed_min)],
          ["Skate", fmtMin(w.time_skate_min)],
          ["Other", fmtMin(w.time_other_min)],
        ] as const,
        mono: w.monotony?.time ?? null,
        strain: w.strain?.time ?? null,
      };
    }
    // TRIMP
    const total =
      (w.trimp_run || 0) +
      (w.trimp_ride || 0) +
      (w.trimp_strength || 0) +
      (w.trimp_mixed || 0) +
      (w.trimp_skate || 0) +
      (w.trimp_other || 0);
    return {
      title: "TRIMP (súčet)",
      totalLabel: fmtTrimp(total),
      breakdown: [
        ["Run", fmtTrimp(w.trimp_run)],
        ["Ride", fmtTrimp(w.trimp_ride)],
        ["Strength", fmtTrimp(w.trimp_strength)],
        ["Mixed", fmtTrimp(w.trimp_mixed)],
        ["Skate", fmtTrimp(w.trimp_skate)],
        ["Other", fmtTrimp(w.trimp_other)],
      ] as const,
      mono: w.monotony?.trimp ?? null,
      strain: w.strain?.trimp ?? null,
    };
  }, [metric, w]);

  return (
    <div className={`${SUBCARD} mt-3 p-3 text-sm`}>
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold">
          Týždeň: {w.label || w.week}{" "}
          <span className="opacity-70">
            ({w.start} – {w.end})
          </span>
        </div>
        <div className="opacity-90">
          {rows.title}: <strong>{rows.totalLabel}</strong>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
        {rows.breakdown.map(([k, v]) => (
          <div
            key={k}
            className="flex items-center justify-between border-b border-neutral-800/60 py-1"
          >
            <span className="opacity-80">{k}</span>
            <span className="font-medium">{v}</span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-4 opacity-90">
        <div style={{ color: THEME.chart.monotony }}>
          Monotony:{" "}
          <strong>
            {rows.mono == null ? "—" : Number(rows.mono).toFixed(2)}
          </strong>
        </div>
        <div style={{ color: THEME.chart.strain }}>
          Strain:{" "}
          <strong>
            {rows.strain == null ? "—" : Math.round(Number(rows.strain))}
          </strong>
        </div>
      </div>
    </div>
  );
}
