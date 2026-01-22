// src/features/calendar/grid/CalendarDayCell.tsx
"use client";

import * as React from "react";
import type { DayCellData } from "@/app/features/calendar/types/calendarTypes";
import { CALENDAR_DAY_CELL } from "@/app/shared/ui/tokens/calendar";
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

export default function CalendarDayCell({
  cell,
  isSelected,
  onSelect,
  sportColors,
}: Props) {
  const isToday = cell.iso === isoToday();
  const [hover, setHover] = React.useState(false);

  const dots: Dot[] = [];
  for (const it of cell.externals)
    dots.push({ key: `e-${it.id}`, sport: String(it.sport), kind: "external" });
  for (const it of cell.activities)
    dots.push({ key: `a-${it.id}`, sport: String(it.sport), kind: "activity" });
  for (const it of cell.plans) {
    const kind: DotKind =
      it.status === "planned" ? "plan" : it.status === "done" ? "done" : "missed";
    dots.push({ key: `p-${it.id}`, sport: String(it.sport), kind });
  }

  const inMonth = !!cell.inMonth;

  // ✅ 1x vypočítaj borderColor (žiadne duplicitné key v objekte)
  const borderColor = isSelected
    ? appColors.brandPrimary
    : isToday
    ? appColors.textMuted
    : appColors.surfaceCardBorder;

  const style: React.CSSProperties = {
    background: hover || isSelected ? appColors.surfaceCardHover : appColors.surfaceCard,
    border: `1px solid ${borderColor}`,
    color: appColors.textPrimary,
    opacity: inMonth ? 1 : 0.45,
    boxShadow: isSelected ? `0 0 0 2px ${appColors.brandPrimary}33` : "none",
    WebkitTapHighlightColor: "transparent",
    outline: "none",
  };

  return (
    <button
      type="button"
      className={CALENDAR_DAY_CELL}
      style={style}
      aria-pressed={isSelected}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      onMouseDown={(e) => {
        // ✅ zabije “sticky focus” hlavne na mobile
        e.preventDefault();
      }}
      onClick={(e) => {
        onSelect(cell.iso);
        // ✅ po kliku nechať bez focusu
        (e.currentTarget as HTMLButtonElement).blur();
      }}
    >
      <div className="flex flex-col">
        <span className="text-sm font-semibold leading-none tracking-tight ml-0.5 mt-0.5">
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
                  style={{ border: `1px solid ${color}`, backgroundColor: "transparent" }}
                />
              );
            }

            if (it.kind === "done") {
              return (
                <span
                  key={it.key}
                  className="text-[11px] leading-none font-semibold"
                  style={{ color }}
                >
                  ✓
                </span>
              );
            }

            return (
              <span
                key={it.key}
                className="text-[11px] leading-none font-semibold"
                style={{ color }}
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