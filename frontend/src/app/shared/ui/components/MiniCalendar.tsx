// src/app/shared/ui/components/MiniCalendar.tsx
"use client";

import * as React from "react";
import { useDayMarks } from "@/app/features/calendar/hooks/useDayMarks";
import { todayIsoLocal } from "@/app/shared/ui/components/StatusMark";
import { DayTile, DowRow } from "@/app/shared/ui/widget/WidgetParts";
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

  const titles = React.useMemo(
    () => ({
      plan: t("calendar.marks.plan"),
      activity: t("calendar.marks.activity"),
      done: t("calendar.marks.done"),
      missed: t("calendar.marks.missed"),
      postponed: t("calendar.marks.postponed"),
    }),
    [t],
  );

  return (
    <div className="flex flex-col gap-1.5" onClick={onOpen} style={{ cursor: onOpen ? "pointer" : "default" }}>
      <DowRow labels={dowLabels} />
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, i) => {
          const d = new Date(startDate);
          d.setDate(startDate.getDate() + i);
          const key = iso(d.getFullYear(), d.getMonth(), d.getDate());
          return (
            <DayTile
              key={key}
              day={d.getDate()}
              marks={byDay.get(key) ?? []}
              today={key === todayKey}
              selected={key === selectedDateIso}
              limit={perDayLimit}
              titles={titles}
              minH={58}
              onClick={onSelectDate ? () => onSelectDate(key) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
