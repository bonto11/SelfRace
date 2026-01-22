// src/features/calendar/grid/CalendarGrid.tsx
"use client";

import * as React from "react";
import type { DayCellData } from "@/app/features/calendar/types/calendarTypes";
import CalendarDayCell from "@/app/features/calendar/grid/CalendarDayCell";
import { appColors } from "@/app/shared/theme/app_colors";

type Props = {
  cells: DayCellData[];
  selectedIso: string | null;
  setSelectedIso: React.Dispatch<React.SetStateAction<string | null>>;
  sportColors: Record<string, string>;
};

export default function CalendarGrid({
  cells,
  selectedIso,
  setSelectedIso,
  sportColors,
}: Props) {
  return (
    <>
      <div
        className="mt-1 grid grid-cols-7 gap-2 text-[11px] uppercase tracking-wide"
        style={{ color: appColors.textMuted }}
      >
        {["p", "u", "s", "š", "p", "s", "n"].map((d) => (
          <div key={d} className="text-center">
            {d}
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {cells.map((c) => (
          <CalendarDayCell
            key={c.iso}
            cell={c}
            isSelected={selectedIso === c.iso}
            sportColors={sportColors}
            onSelect={(isoVal) =>
              setSelectedIso((cur) => (cur === isoVal ? null : isoVal))
            }
          />
        ))}
      </div>
    </>
  );
}