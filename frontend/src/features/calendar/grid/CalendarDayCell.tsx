// src/features/calendar/grid/CalendarDayCell.tsx
"use client";

import * as React from "react";
import type { DayCellData } from "@/features/calendar/types/calendarTypes";
import { CALENDAR_DAY_CELL } from "@/shared/ui/classes";

type Props = {
  cell: DayCellData;
  isSelected: boolean;
  onSelect: (iso: string) => void;
  sportColors: Record<string, string>;
};

export default function CalendarDayCell({
  cell,
  isSelected,
  onSelect,
  sportColors,
}: Props) {
  const muted = cell.inMonth ? "" : "opacity-40";

  type DotKind = "external" | "activity" | "plan" | "done" | "missed";
  type Dot = { key: string; sport: string; kind: DotKind };

  const dots: Dot[] = [];

  for (const it of cell.externals)
    dots.push({
      key: `e-${it.id}`,
      sport: String(it.sport),
      kind: "external",
    });
  for (const it of cell.activities)
    dots.push({
      key: `a-${it.id}`,
      sport: String(it.sport),
      kind: "activity",
    });
  for (const it of cell.plans) {
    const kind: DotKind =
      it.status === "planned"
        ? "plan"
        : it.status === "done"
        ? "done"
        : "missed";
    dots.push({ key: `p-${it.id}`, sport: String(it.sport), kind });
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(cell.iso)}
      className={[
        "px-2 py-1.5 text-left w-full focus:outline-none",
        CALENDAR_DAY_CELL,
        "min-h-[56px]",
        isSelected ? "ring-2 ring-emerald-500/60" : "",
        "hover:bg-white/10",
        muted,
      ].join(" ")}
      aria-pressed={isSelected}
    >
      <div className="flex flex-col">
        <span className="text-sm font-semibold leading-none tracking-tight ml-0.5 mt-0.5 select-none">
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
                  className="inline-block w-1.5 h-1.5 rounded-full border"
                  style={{
                    borderColor: color,
                    backgroundColor: "transparent",
                  }}
                />
              );
            }

            if (it.kind === "done") {
              return (
                <span
                  key={it.key}
                  className="text-[11px] leading-none"
                  style={{ color }}
                >
                  ✓
                </span>
              );
            }

            return (
              <span
                key={it.key}
                className="text-[11px] leading-none"
                style={{ color }}
              >
                ×
              </span>
            );
          })}

          {dots.length > 8 && (
            <span className="text-[10px] opacity-70">
              +{dots.length - 8}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}