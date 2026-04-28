// src/features/calendar/grid/CalendarDayCell.tsx
"use client";

import * as React from "react";
import type { DayCellData } from "@/app/features/calendar/types/calendarTypes";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  CALENDAR_DAY_CELL,
  CALENDAR_DAY_CELL_OUT,
  CALENDAR_DAY_CELL_SELECTED,
  CALENDAR_DAY_NUM,
  CALENDAR_DOTS_WRAP,
  CALENDAR_DOT,
  CALENDAR_PLAN_DOT,
  CALENDAR_MARK,
  CALENDAR_MORE,
} from "@/app/shared/ui/tokens";

type Props = {
  cell: DayCellData;
  isSelected: boolean;
  sportColors: Record<string, string>;
  onSelect: (iso: string) => void;
};

export default function CalendarDayCell({
  cell,
  isSelected,
  sportColors,
  onSelect,
}: Props) {
  const isToday = React.useMemo(() => {
    return cell.iso === new Date().toISOString().slice(0, 10);
  }, [cell.iso]);

  const items = React.useMemo(() => {
    const list: Array<{ kind: string; sport: string }> = [];

    // activities
    for (const a of cell.activities) {
      list.push({ kind: "activity", sport: String(a.sport) });
    }
    // externals
    for (const e of cell.externals) {
      list.push({ kind: "external", sport: String(e.sport) });
    }
    // plans
    for (const p of cell.plans) {
      // p.status by mal prísť z useCalendarMap ako 'plan' | 'done' | 'missed' | 'skipped'
      // Používame p.status, nie len p.kind, aby sme mali presný stav
      const status = (p as any).status || (p as any).kind || "plan";
      list.push({ kind: status, sport: String(p.sport) });
    }
    return list;
  }, [cell]);

  // styles
  const baseClasses = [CALENDAR_DAY_CELL];
  if (!cell.inMonth) baseClasses.push(CALENDAR_DAY_CELL_OUT);

  const style: React.CSSProperties = {
    background: isSelected ? "rgba(255,255,255,0.08)" : appColors.inputBg,
    borderColor: isSelected
      ? appColors.brandPrimary
      : appColors.surfaceCardBorder,
    color: appColors.textPrimary,
    cursor: "pointer",
  };

  if (isSelected) {
    style.boxShadow = `0 0 0 2px ${appColors.brandPrimary}`;
  } else if (isToday) {
    style.boxShadow = `0 0 0 2px ${appColors.statusSuccess}55`;
  }

  const maxVisible = 4;
  const shown = items.slice(0, maxVisible);
  const diff = items.length - maxVisible;

  return (
    <div
      className={baseClasses.join(" ")}
      style={style}
      onClick={() => onSelect(cell.iso)}
    >
      <div className="flex flex-col h-full relative">
        <span
          className={CALENDAR_DAY_NUM}
          style={{ color: isToday ? appColors.statusSuccess : undefined }}
        >
          {cell.day ?? ""}
        </span>

        <div className={CALENDAR_DOTS_WRAP}>
          {shown.map((it, idx) => {
            const color = sportColors[it.sport] ?? sportColors.other;

            if (it.kind === "activity" || it.kind === "external") {
              return (
                <span
                  key={idx}
                  className={CALENDAR_DOT}
                  style={{ backgroundColor: color }}
                />
              );
            }

            if (it.kind === "plan" || it.kind === "planned") {
              return (
                <span
                  key={idx}
                  className={CALENDAR_PLAN_DOT}
                  style={{ borderColor: color, backgroundColor: "transparent" }}
                />
              );
            }

            if (it.kind === "done") {
              return (
                <span key={idx} className={CALENDAR_MARK} style={{ color }}>
                  ✓
                </span>
              );
            }

            // 🌟 TU JE OPRAVA PRE SKIPPED TRÉNING (Šípka miesto krížika)
            if (it.kind === "skipped") {
              return (
                <span
                  key={idx}
                  className={CALENDAR_MARK}
                  style={{ 
                    color: "rgba(255, 255, 255, 0.4)", 
                    fontSize: "12px", 
                    fontWeight: "bold", 
                    lineHeight: 1 
                  }}
                  title="Odložené"
                >
                  ↷
                </span>
              );
            }

            // Fallback: Zmeškaný
            return (
              <span
                key={idx}
                className={CALENDAR_MARK}
                style={{ color: appColors.statusError }}
              >
                ✕
              </span>
            );
          })}
          {diff > 0 && (
            <span
              className={CALENDAR_MORE}
              style={{ color: appColors.textMuted }}
            >
              +{diff}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}