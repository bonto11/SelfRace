// src/features/calendar/grid/CalendarGrid.tsx
"use client";

import * as React from "react";
import type { DayCellData } from "@/app/features/calendar/types/calendarTypes";
import CalendarDayCell from "@/app/features/calendar/grid/CalendarDayCell";
import { DowRow } from "@/app/shared/ui/widget/WidgetParts";
import { useT } from "@/app/shared/i18n/useT";

type Props = {
  cells: DayCellData[];
  selectedIso: string | null;
  setSelectedIso: React.Dispatch<React.SetStateAction<string | null>>;
};

export default function CalendarGrid({
  cells,
  selectedIso,
  setSelectedIso,
}: Props) {
  const t = useT();
  const dow = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((k) => t(`common.weeksShort.${k}` as any));
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <DowRow labels={dow} />
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c) => (
          <CalendarDayCell
            key={c.iso}
            cell={c}
            isSelected={selectedIso === c.iso}
            onSelect={(isoVal) => setSelectedIso((cur) => (cur === isoVal ? null : isoVal))}
          />
        ))}
      </div>
    </div>
  );
}
