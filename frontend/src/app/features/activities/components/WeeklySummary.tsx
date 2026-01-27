// src/features/activity/components/WeeklySummary.tsx
"use client";

import { useMemo } from "react";
import {
  SUBCARD,
  PANEL_INNER_STACK,
  PANEL_PREVIEW,
  PANEL_SECTION_HEAD,
  PANEL_SECTION_TITLE,
  PANEL_SECTION_SUBTITLE,
  PANEL_GRID_3,
  PANEL_LIST,
  PANEL_LIST_ITEM,
  PANEL_ACTIONS_INLINE,
  PANEL_BADGE,
  PANEL_SECTION_TEXT,
  PANEL_SECTION_LABEL,
} from "@/app/shared/ui/tokens";

import { WeekRow } from "@/app/features/activities/types/WeeklyLoad";
import { Metric } from "@/app/features/activities/types/activities";

type Props = {
  weeks: WeekRow[];
  metric: Metric;
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
      <div className={[SUBCARD, PANEL_PREVIEW].join(" ")}>
        Nenašiel sa týždeň <code>{selectedWeek}</code>.
      </div>
    );
  }

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
    <div className={[SUBCARD, PANEL_INNER_STACK].join(" ")}>
      {/* head row */}
      <div className={PANEL_SECTION_HEAD}>
        <div>
          <div className={PANEL_SECTION_TITLE}>
            Týždeň: {w.label || w.week}
          </div>
          <div className={[PANEL_SECTION_SUBTITLE, "opacity-70"].join(" ")}>
            {w.start} – {w.end}
          </div>
        </div>

        <div className={PANEL_ACTIONS_INLINE}>
          <span className={PANEL_SECTION_TEXT}>{rows.title}:</span>
          <span className={PANEL_BADGE}>{rows.totalLabel}</span>
        </div>
      </div>

      {/* breakdown */}
      <div className={PANEL_GRID_3}>
        <div className={PANEL_LIST}>
          {rows.breakdown.map(([k, v]) => (
            <div key={k} className={PANEL_LIST_ITEM}>
              <span className={PANEL_SECTION_LABEL + " opacity-80"}>{k}</span>
              <span className={PANEL_SECTION_TEXT}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* mono/strain */}
      <div className={PANEL_ACTIONS_INLINE}>
        <span className={PANEL_SECTION_LABEL + " opacity-80"}>Monotony</span>
        <span
          className={PANEL_BADGE}
          data-tone="mono"
          style={undefined}
        >
          {rows.mono == null ? "—" : Number(rows.mono).toFixed(2)}
        </span>

        <span className={PANEL_SECTION_LABEL + " opacity-80"}>Strain</span>
        <span
          className={PANEL_BADGE}
          data-tone="strain"
          style={undefined}
        >
          {rows.strain == null ? "—" : Math.round(Number(rows.strain))}
        </span>
      </div>
    </div>
  );
}