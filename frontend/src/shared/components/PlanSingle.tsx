// src/shared/components/PlanSingle.tsx
"use client";

import * as React from "react";
import { THEME } from "@/shared/theme/tokens";

const SPORT_COLORS: Record<string, string> = {
  run: THEME.chart.run,
  ride: THEME.chart.ride,
  swim: THEME.chart.swim,
  strength: THEME.chart.strength,
  mixed: THEME.chart.mixed,
  skate: THEME.chart.skate,
  walk: THEME.chart.walk,
  other: THEME.chart.other,
};

export type PlanStatus = "planned" | "done" | "missed";

type Props = {
  id: number;
  title: string;
  dateIso: string;
  sport: string;
  status: PlanStatus;
  planDur?: string | null;
  planIntensity?: string | null;
  planTarget?: string | null;
  planNotes?: string | null;
  activitySummary?: string | null; // napr. "Afternoon Run · 8.15 km · 53 min"
  children?: React.ReactNode; // selector + Save
};

function prettySkDate(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const wk = d.toLocaleDateString("sk-SK", { weekday: "short" });
  return `${wk} · ${day}`;
}

function statusLabel(status: PlanStatus): string {
  if (status === "done") return "hotovo";
  if (status === "missed") return "missed";
  return "planned";
}

function statusCls(status: PlanStatus): string {
  if (status === "done")
    return "border-emerald-500/80 text-emerald-300 bg-emerald-500/5";
  if (status === "missed")
    return "border-orange-500/80 text-orange-300 bg-orange-500/5";
  return "border-slate-500/80 text-slate-200 bg-slate-500/5";
}

export default function PlanSingle({
  id,
  title,
  dateIso,
  sport,
  status,
  planDur,
  planIntensity,
  planTarget,
  planNotes,
  activitySummary,
  children,
}: Props) {
  const [open, setOpen] = React.useState(false);

  const color = SPORT_COLORS[sport] ?? SPORT_COLORS.other;

  return (
    <div
      className="rounded-2xl border border-neutral-800 bg-neutral-900 px-3 py-2"
      data-plan-id={id}
    >
      {/* HEADER – vždy viditeľný */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left flex items-center justify-between gap-3"
      >
        <div className="flex flex-col gap-0.5">
          <div className="text-[11px] uppercase opacity-70">
            {prettySkDate(dateIso)}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-sm">{title}</span>
            <span
              className={[
                "inline-flex items-center justify-center rounded-full text-[10px] px-2 py-0.5 border",
                statusCls(status),
              ].join(" ")}
            >
              ✓ {statusLabel(status)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px]"
            style={{
              border: `1px solid ${color}`,
              color,
            }}
          >
            {sport}
          </span>
          <span className="text-xs opacity-60">
            {open ? "▴" : "▾"}
          </span>
        </div>
      </button>

      {/* BODY – len v rozbalenom stave */}
      {open && (
        <div className="mt-2 pt-2 border-t border-neutral-800 text-xs space-y-1.5">
          {planDur && (
            <div>
              <span className="opacity-60 mr-1">Planned duration:</span>
              <span>{planDur}</span>
            </div>
          )}
          {planIntensity && (
            <div>
              <span className="opacity-60 mr-1">Intensity:</span>
              <span>{planIntensity}</span>
            </div>
          )}
          {planTarget && (
            <div>
              <span className="opacity-60 mr-1">Target:</span>
              <span>{planTarget}</span>
            </div>
          )}
          {planNotes && (
            <div className="opacity-80">{planNotes}</div>
          )}

          {activitySummary && (
            <div className="pt-1">
              <span className="opacity-60 mr-1">Real:</span>
              <span>{activitySummary}</span>
            </div>
          )}

          {children && (
            <div className="pt-2 border-t border-neutral-800">
              {children}
            </div>
          )}
        </div>
      )}
    </div>
  );
}