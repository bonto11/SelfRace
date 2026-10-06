// src/features/calendar/grid/CalendarDayCell.tsx
"use client";

import * as React from "react";
import type { DayCellData } from "@/app/features/calendar/types/calendarTypes";
import { CALENDAR_DAY_CELL } from "@/app/shared/ui/tokens/calendar";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { StatusMark, planMarkKind, todayIsoLocal, type MarkKind } from "@/app/shared/ui/components/StatusMark";
import { useT } from "@/app/shared/i18n/useT";

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
  const today = todayIsoLocal();
  const isToday = cell.iso === today;
  const [hover, setHover] = React.useState(false);

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

  const inMonth = !!cell.inMonth;

  const borderColor = isSelected
    ? appColors.brandPrimary
    : isToday
      ? appColors.textMuted
      : appColors.surfaceCardBorder;

  const style: React.CSSProperties = {
    background:
      hover || isSelected ? appColors.surfaceCardHover : appColors.surfaceCard,
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
        e.preventDefault();
      }}
      onClick={(e) => {
        onSelect(cell.iso);
        (e.currentTarget as HTMLButtonElement).blur();
      }}
    >
      <div className="flex flex-col">
        <span className="text-sm font-semibold leading-none tracking-tight ml-0.5 mt-0.5">
          {cell.day ?? ""}
        </span>

        <div className="mt-1.5 pl-0.5 pr-0.5 flex flex-wrap gap-1 items-center">
          {dots.slice(0, 8).map((it) => (
            <StatusMark key={it.key} kind={it.kind} sport={it.sport} size="xs" title={t(`calendar.marks.${it.kind}` as any)} />
          ))}

          {dots.length > 8 && (
            <span
              className="text-[10px]"
              style={{ color: appColors.textMuted }}
            >
              +{dots.length - 8}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
