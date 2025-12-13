"use client";

import * as React from "react";
import { SURFACE_INLINE, SURFACE_CARD } from "@/shared/ui/classes";
import SportBadge from "@/shared/components/ui/SportBadge"


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

  const kpis = [
    planDur ? { label: "DURATION", value: planDur } : null,
    planIntensity ? { label: "INTENSITY", value: planIntensity } : null,
    planTarget ? { label: "TARGET", value: planTarget } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className={[SURFACE_CARD, "px-3 py-2"].join(" ")} data-plan-id={id}>
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
              {statusLabel(status)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <SportBadge sport={sport}/>
          <span className="text-xs opacity-60">{open ? "▴" : "▾"}</span>
        </div>
      </button>

      {/* BODY – len v rozbalenom stave */}
      {open && (
        <div className="mt-2 pt-2 border-t border-neutral-800 text-xs space-y-3">
          {/* KPI chips – rovnaký štýl ako v ActivitySingle (plan) */}
          {kpis.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {kpis.map((k) => (
                <div
                  key={k.label}
                  className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}
                >
                  <div className="text-[10px] opacity-70">{k.label}</div>
                  <div className="text-xl font-semibold tabular-nums">
                    {k.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Popis / štruktúra (vrátane Exercises, lebo ich máš v planNotes) */}
          {planNotes && (
            <div className="text-xs sm:text-sm opacity-90">{planNotes}</div>
          )}

          {/* Real aktivita – zhrnutie */}
          {activitySummary && (
            <div className="text-xs sm:text-sm">
              <span className="opacity-60 mr-1">Real:</span>
              <span>{activitySummary}</span>
            </div>
          )}

          {/* Selector + Save */}
          {children && (
            <div className="pt-2 border-t border-neutral-800">{children}</div>
          )}
        </div>
      )}
    </div>
  );
}

