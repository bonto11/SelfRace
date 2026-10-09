// src/features/calendar/grid/CalendarDayCell.tsx
"use client";

import * as React from "react";
import type { DayCellData } from "@/app/features/calendar/types/calendarTypes";
import { DayTile } from "@/app/shared/ui/widget/WidgetParts";
import { planMarkKind, todayIsoLocal, type MarkKind } from "@/app/shared/ui/components/StatusMark";
import { useT } from "@/app/shared/i18n/useT";
import { useThreadUnread } from "@/app/features/trainer/hooks/useThreadUnread";

type Props = {
  cell: DayCellData;
  isSelected: boolean;
  onSelect: (iso: string) => void;
};

type Dot = { key: string; sport: string; kind: MarkKind };

export default function CalendarDayCell({
  cell,
  isSelected,
  onSelect,
}: Props) {
  const t = useT();
  const { hasUnreadOnDate } = useThreadUnread();
  const today = todayIsoLocal();
  const isToday = cell.iso === today;

  const dots: Dot[] = [];
  // externá aktivita: spárovaná so Stravou = ✓, inak krúžok ako plán
  for (const it of cell.externals)
    dots.push({
      key: `e-${it.id}`,
      sport: String(it.sport),
      kind: planMarkKind({ status: "planned", dateIso: cell.iso, activityId: it.activityId, external: true, todayIso: today }),
    });
  for (const it of cell.activities)
    dots.push({ key: `a-${it.id}`, sport: String(it.sport), kind: "activity" });
  // stav plánu už vyhodnotil useCalendarMap (vrátane zmeškaného v minulosti)
  for (const it of cell.plans)
    dots.push({
      key: `p-${it.id}`,
      sport: String(it.sport),
      kind: planMarkKind({ status: it.status as any, dateIso: cell.iso, activityId: (it as any).activityId ?? null, todayIso: today }),
    });

  return (
    <DayTile
      day={cell.day}
      marks={dots}
      today={isToday}
      selected={isSelected}
      dim={!cell.inMonth}
      limit={6}
      markSize="xs"
      minH={60}
      badge={hasUnreadOnDate(cell.iso)}
      badgeTitle={t("trainer.thread.unread")}
      titles={{
        plan: t("calendar.marks.plan"),
        activity: t("calendar.marks.activity"),
        done: t("calendar.marks.done"),
        missed: t("calendar.marks.missed"),
        postponed: t("calendar.marks.postponed"),
      }}
      onClick={() => onSelect(cell.iso)}
    />
  );
}
