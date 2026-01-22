// src/features/calendar/grid/CalendarDayCell.tsx
"use client";

import * as React from "react";
import type { DayCellData } from "@/app/features/calendar/types/calendarTypes";
import { CALENDAR_DAY_CELL } from "@/app/shared/theme/uiTokens";
import { appColors } from "@/app/shared/theme/app_colors";

type Props = {
  cell: DayCellData;
  isSelected: boolean;
  onSelect: (iso: string) => void;
  sportColors: Record<string, string>;
};

type DotKind = "external" | "activity" | "plan" | "done" | "missed";
type Dot = { key: string; sport: string; kind: DotKind };

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function pickDayCellStyle(opts: {
  inMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
}) {
  const { inMonth, isSelected, isToday } = opts;

  // base
  const style: React.CSSProperties = {
    border: `1px solid ${appColors.surfaceCardBorder}`,
    background: appColors.surfaceCardBg,
    color: appColors.textPrimary,
    transition: "background 120ms ease, border-color 120ms ease, box-shadow 120ms ease",
    boxShadow: "none",
    opacity: inMonth ? 1 : 0.45,
  };

  // today outline (subtle)
  if (isToday) {
    style.borderColor = appColors.textMuted;
  }

  // selected (stronger ring-ish look, but still appColors)
  if (isSelected) {
    style.borderColor = appColors.brandPrimary;
    style.boxShadow = `0 0 0 2px ${appColors.brandPrimary}33`; // 20% alpha
  }

  return style;
}

export default function CalendarDayCell({
  cell,
  isSelected,
  onSelect,
  sportColors,
}: Props) {
  const isToday = cell.iso === isoToday();

  const dots: Dot[] = [];

  for (const it of cell.externals) {
    dots.push({ key: `e-${it.id}`, sport: String(it.sport), kind: "external" });
  }
  for (const it of cell.activities) {
    dots.push({ key: `a-${it.id}`, sport: String(it.sport), kind: "activity" });
  }
  for (const it of cell.plans) {
    const kind: DotKind =
      it.status === "planned" ? "plan" : it.status === "done" ? "done" : "missed";
    dots.push({ key: `p-${it.id}`, sport: String(it.sport), kind });
  }

  const style = pickDayCellStyle({
    inMonth: !!cell.inMonth,
    isSelected,
    isToday,
  });

  return (
    <button
      type="button"
      onClick={() => onSelect(cell.iso)}
      className={[
        "px-2 py-1.5 text-left w-full focus:outline-none rounded-xl",
        CALENDAR_DAY_CELL,
        "min-h-[56px]",
      ].join(" ")}
      style={style}
      aria-pressed={isSelected}
      onMouseEnter={(e) => {
        // hover look (no tailwind bg-*): slightly brighter bg
        if (isSelected) return;
        (e.currentTarget.style.background as any) = appColors.buttonGhostBgHover;
        e.currentTarget.style.borderColor = appColors.surfaceCardBorder;
      }}
      onMouseLeave={(e) => {
        // reset hover
        const base = pickDayCellStyle({
          inMonth: !!cell.inMonth,
          isSelected,
          isToday,
        });
        e.currentTarget.style.background = String(base.background ?? "");
        e.currentTarget.style.borderColor = String(base.borderColor ?? appColors.surfaceCardBorder);
        e.currentTarget.style.boxShadow = String(base.boxShadow ?? "none");
        e.currentTarget.style.opacity = String(base.opacity ?? 1);
      }}
    >
      <div className="flex flex-col">
        <span
          className="text-sm font-semibold leading-none tracking-tight ml-0.5 mt-0.5 select-none"
          style={{ color: isSelected ? appColors.textPrimary : appColors.textPrimary }}
        >
          {cell.day ?? ""}
        </span>

        <div className="mt-1.5 pl-0.5 pr-0.5 flex flex-wrap gap-1 items-center">
          {dots.slice(0, 8).map((it) => {
            const color = sportColors[it.sport] ?? sportColors.other;

            if (it.kind === "activity" || it.kind === "external") {
              return (
                <span
                  key={it.key}
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
              );
            }

            if (it.kind === "plan") {
              return (
                <span
                  key={it.key}
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{
                    border: `1px solid ${color}`,
                    backgroundColor: "transparent",
                  }}
                />
              );
            }

            if (it.kind === "done") {
              return (
                <span
                  key={it.key}
                  className="text-[11px] leading-none font-semibold"
                  style={{ color: appColors.statusInfo }}
                >
                  ✓
                </span>
              );
            }

            return (
              <span
                key={it.key}
                className="text-[11px] leading-none font-semibold"
                style={{ color: appColors.statusWarning }}
              >
                ×
              </span>
            );
          })}

          {dots.length > 8 && (
            <span className="text-[10px]" style={{ color: appColors.textMuted }}>
              +{dots.length - 8}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}