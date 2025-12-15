"use client";

import * as React from "react";
import { SURFACE_CARD, SURFACE_INLINE } from "@/shared/ui/classes";
import SportBadge from "@/shared/components/ui/SportBadge";
import type{ CalendarItemKind, CalendarPlanStatus } from "@/features/calendar/types/calendarTypes";

type Props = {
  kind: CalendarItemKind;
  id: string | number;

  dateIso: string; // YYYY-MM-DD
  sport: string;
  title: string;

  // pre plan (optional)
  status?: CalendarPlanStatus;

  // meta
  timeLabel?: string | null; // pre external (start time)
  distanceKm?: number | null; // activity
  durationMin?: number | null; // activity
  kpis?: Array<{ label: string; value: string }>; // plan KPI

  notes?: string | null; // plan notes / external notes
  realSummary?: string | null; // "Real: …" pre linked plan (len ak chceš)

  onOpenActivity?: (() => void) | null; // pre activity (ak chceš otvoriť detail)
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

function statusLabel(status: CalendarPlanStatus) {
  if (status === "done") return "hotovo";
  if (status === "missed") return "missed";
  return "planned";
}

function statusCls(status: CalendarPlanStatus): string {
  if (status === "done")
    return "border-emerald-500/80 text-emerald-300 bg-emerald-500/5";
  if (status === "missed")
    return "border-orange-500/80 text-orange-300 bg-orange-500/5";
  return "border-slate-500/80 text-slate-200 bg-slate-500/5";
}

export default function CalendarItemCard({
  kind,
  id,
  dateIso,
  sport,
  title,
  status,
  timeLabel,
  distanceKm,
  durationMin,
  kpis,
  notes,
  realSummary,
  onOpenActivity,
}: Props) {
  const [open, setOpen] = React.useState(false);

  const hasBody =
    !!(kpis && kpis.length) ||
    !!notes ||
    !!realSummary ||
    (kind === "activity" && (distanceKm != null || durationMin != null)) ||
    !!onOpenActivity;

  const activitySummary =
    kind === "activity"
      ? [
          distanceKm != null ? `${distanceKm.toFixed(2)} km` : null,
          durationMin != null ? `${durationMin} min` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

  return (
    <div className={[SURFACE_CARD, "px-3 py-2"].join(" ")} data-cal-id={id}>
      <button
        type="button"
        onClick={() => (hasBody ? setOpen((o) => !o) : null)}
        className="w-full text-left flex items-center justify-between gap-3"
      >
        <div className="flex flex-col gap-0.5">
          <div className="text-[11px] uppercase opacity-70">
            {prettySkDate(dateIso)}
            {timeLabel ? ` • ${timeLabel}` : ""}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-sm">{title}</span>

            {status && (
              <span
                className={[
                  "inline-flex items-center justify-center rounded-full text-[10px] px-2 py-0.5 border",
                  statusCls(status),
                ].join(" ")}
              >
                {statusLabel(status)}
              </span>
            )}
          </div>

          {kind === "activity" && activitySummary && (
            <div className="text-[12px] opacity-75">{activitySummary}</div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <SportBadge sport={sport} />
          {hasBody && <span className="text-xs opacity-60">{open ? "▴" : "▾"}</span>}
        </div>
      </button>

      {open && hasBody && (
        <div className="mt-2 pt-2 border-t border-neutral-800 text-xs space-y-3">
          {kpis && kpis.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {kpis.map((k) => (
                <div key={k.label} className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
                  <div className="text-[10px] opacity-70">{k.label}</div>
                  <div className="text-xl font-semibold tabular-nums">{k.value}</div>
                </div>
              ))}
            </div>
          )}

          {notes && <div className="text-xs sm:text-sm opacity-90">{notes}</div>}

          {realSummary && (
            <div className="text-xs sm:text-sm">
              <span className="opacity-60 mr-1">Real:</span>
              <span>{realSummary}</span>
            </div>
          )}

          {onOpenActivity && (
            <div className="pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={onOpenActivity}
                className="text-xs px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10"
              >
                Otvoriť aktivitu
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}