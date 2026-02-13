// src/features/calendar/detail/CalendarItemCard.tsx
"use client";

import * as React from "react";

import { SURFACE_CARD, SURFACE_INLINE } from "@/app/shared/ui/tokens";
import { appColors } from "@/app/shared/ui/theme/app_colors";

import SportBadge from "@/app/shared/ui/components/SportBadge";
import type {
  CalendarItemKind,
  CalendarPlanStatus,
} from "@/app/features/calendar/types/calendarTypes";
import { useT } from "@/app/shared/i18n/useT";

type Props = {
  kind: CalendarItemKind;
  id: string | number;

  dateIso: string; // YYYY-MM-DD
  sport: string;
  title: string;

  status?: CalendarPlanStatus;

  timeLabel?: string | null;
  distanceKm?: number | null;
  durationMin?: number | null;
  kpis?: Array<{ label: string; value: string }>;

  notes?: string | null;
  realSummary?: string | null;

  onOpenActivity?: (() => void) | null;
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

function statusLabel(status: CalendarPlanStatus, t: any) {
  if (status === "done") return t("calendar.planDone");
  if (status === "missed") return t("calendar.planMissed");
  return t("calendar.planPlaned");
}

function statusStyle(status: CalendarPlanStatus): React.CSSProperties {
  // ✅ no tailwind emerald/orange; use appColors only
  if (status === "done") {
    return {
      borderColor: appColors.statusInfo,
      color: appColors.statusInfo,
      background: "transparent",
    };
  }
  if (status === "missed") {
    return {
      borderColor: appColors.statusWarning,
      color: appColors.statusWarning,
      background: "transparent",
    };
  }
  return {
    borderColor: appColors.surfaceCardBorder,
    color: appColors.textMuted,
    background: "transparent",
  };
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
  const t = useT();

  const hasBody =
    !!(kpis && kpis.length) ||
    !!notes ||
    !!realSummary ||
    (kind === "activity" && (distanceKm != null || durationMin != null)) ||
    !!onOpenActivity;

  const activitySummary =
    kind === "activity"
      ? [
          distanceKm != null ? `${distanceKm.toFixed(2)} ${t("common.units.km")}` : null,
          durationMin != null ? `${durationMin} ${t("common.units.min")}` : null,
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
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="text-[11px] uppercase opacity-70">
            {prettySkDate(dateIso)}
            {timeLabel ? ` • ${timeLabel}` : ""}
          </div>

          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="font-semibold text-sm truncate">{title}</span>

            {status && (
              <span
                className="inline-flex items-center justify-center rounded-full text-[10px] px-2 py-0.5 border"
                style={statusStyle(status)}
              >
                {statusLabel(status,t)}
              </span>
            )}
          </div>

          {kind === "activity" && activitySummary && (
            <div className="text-[12px] opacity-75">{activitySummary}</div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <SportBadge sport={sport} />
          {hasBody && (
            <span className="text-xs opacity-60">{open ? "▴" : "▾"}</span>
          )}
        </div>
      </button>

      {open && hasBody && (
        <div
          className="mt-2 pt-2 text-xs space-y-3"
          style={{ borderTop: `1px solid ${appColors.surfaceCardBorder}` }}
        >
          {kpis && kpis.length > 0 && (
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

          {notes && (
            <div className="text-xs sm:text-sm opacity-90">{notes}</div>
          )}

          {realSummary && (
            <div className="text-xs sm:text-sm">
              <span className="opacity-60 mr-1">MBP Real:</span>
              <span>{realSummary}</span>
            </div>
          )}

          {onOpenActivity && (
            <div
              style={{ borderTop: `1px solid ${appColors.surfaceCardBorder}` }}
              className="pt-2"
            >
              <button
                type="button"
                onClick={onOpenActivity}
                className="text-xs px-3 py-2 rounded-lg"
                style={{
                  background: appColors.buttonGhostBgHover,
                  border: `1px solid ${appColors.surfaceCardBorder}`,
                  color: appColors.textPrimary,
                }}
              >
                {t("calendar.openActivity")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
