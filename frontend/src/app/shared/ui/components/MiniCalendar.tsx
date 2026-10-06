// src/app/shared/ui/components/MiniCalendar.tsx
"use client";

import * as React from "react";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useDayMarks } from "@/app/features/calendar/hooks/useDayMarks";
import { StatusMark, todayIsoLocal } from "@/app/shared/ui/components/StatusMark";

import {
  CAL_WIDGET_DOW_ROW,
  CAL_WIDGET_DOW_CELL,
  CAL_WIDGET_GRID,
  CAL_WIDGET_DAY_CELL,
  CAL_WIDGET_DAY_NUM,
  CAL_WIDGET_ITEMS_WRAP,
  CAL_WIDGET_MORE,
} from "@/app/shared/ui/tokens/calendar";
import { useT } from "@/app/shared/i18n/useT";

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));
const iso = (y: number, m0: number, d: number) => `${y}-${pad2(m0 + 1)}-${pad2(d)}`;

function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Po=0..Ne=6
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

type MiniCalendarProps = {
  startFrom?: "monday" | "today";
  perDayLimit?: number;
  onOpen?: () => void;
  selectedDateIso?: string;
  onSelectDate?: (dateIso: string) => void;
};

/**
 * Týždeň po dňoch so značkami stavu (StatusMark): plán, splnené, zmeškané,
 * odložené, aktivita mimo plánu. Dáta skladá useDayMarks – rovnako ako denný
 * widget, takže widget, denný plán aj kalendár ukazujú to isté.
 */
export default function MiniCalendar({
  startFrom = "monday",
  perDayLimit = 6,
  onOpen,
  selectedDateIso,
  onSelectDate,
}: MiniCalendarProps) {
  const t = useT();

  const startDate = React.useMemo(() => {
    if (startFrom === "today") {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    }
    return startOfWeek();
  }, [startFrom]);

  const endDate = React.useMemo(() => {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + 6);
    return d;
  }, [startDate]);

  const startIso = iso(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const endIso = iso(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  const byDay = useDayMarks(startIso, endIso);
  const todayKey = todayIsoLocal();

  const dowLabels = React.useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const daysMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      return t(`common.weeksShort.${daysMap[d.getDay()]}` as any);
    });
  }, [startDate, t]);

  return (
    <div className="flex flex-col h-full">
      <div
        className={CAL_WIDGET_DOW_ROW}
        style={{ color: appColors.textMuted }}
      >
        {dowLabels.map((dayLabel, idx) => (
          <div key={idx} className={CAL_WIDGET_DOW_CELL}>
            {dayLabel}
          </div>
        ))}
      </div>

      <div
        className={CAL_WIDGET_GRID}
        onClick={onOpen}
        style={{ cursor: onOpen ? "pointer" : "default" }}
      >
        {Array.from({ length: 7 }).map((_, i) => {
          const d = new Date(startDate);
          d.setDate(startDate.getDate() + i);

          const key = iso(d.getFullYear(), d.getMonth(), d.getDate());
          const items = byDay.get(key) ?? [];
          const shown = items.slice(0, perDayLimit);
          const isToday = key === todayKey;
          const isSelected = key === selectedDateIso;

          const cellStyle: React.CSSProperties = {
            background: isSelected ? "rgba(255,255,255,0.08)" : appColors.inputBg,
            borderColor: isSelected ? appColors.brandPrimary : appColors.surfaceCardBorder,
            color: appColors.textPrimary,
            WebkitTapHighlightColor: "transparent",
            cursor: onSelectDate ? "pointer" : "default",
            ...(isSelected 
              ? { boxShadow: `0 0 0 2px ${appColors.brandPrimary}` }
              : isToday 
                ? { boxShadow: `0 0 0 2px ${appColors.statusSuccess}55` } 
                : null),
          };

          return (
            <div 
              key={key} 
              className={CAL_WIDGET_DAY_CELL} 
              style={cellStyle}
              onClick={(e) => {
                if (onSelectDate) {
                  e.stopPropagation();
                  onSelectDate(key);
                }
              }}
            >
              <div className="flex flex-col">
                <span className={CAL_WIDGET_DAY_NUM}>{d.getDate()}</span>

                <div className={CAL_WIDGET_ITEMS_WRAP}>
                  {shown.map((it) => (
                    <StatusMark key={it.key} kind={it.kind} sport={it.sport} size="xs" title={t(`calendar.marks.${it.kind}` as any)} />
                  ))}

                  {items.length > shown.length && (
                    <span
                      className={CAL_WIDGET_MORE}
                      style={{ color: appColors.textMuted }}
                    >
                      +{items.length - shown.length}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}