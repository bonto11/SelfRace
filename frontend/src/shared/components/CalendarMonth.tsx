"use client";

import React from "react";
import Button from "@/shared/components/ui/Button";

// jednoduchý typ – stačí id a name (pridaj si čo chceš)
export type CalActivity = { id: number; name: string; date: string }; // date = "YYYY-MM-DD"

type Props = {
  year: number;
  month: number; // 1-12
  itemsByDay: Record<string, CalActivity[]>; // kľúč = YYYY-MM-DD
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  onOpenActivity?: (id: number) => void;
  className?: string;
};

const WEEK_HDR = ["p", "u", "s", "š", "p", "s", "n"]; // pondelok-first

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
/** vygeneruje mriežku dní (6 týždňov, PO→NE) vrátane okrajov z minulého/ďalšieho mesiaca */
function buildGrid(year: number, month1to12: number) {
  const m0 = month1to12 - 1;
  const first = new Date(year, m0, 1);
  const last = endOfMonth(first);
  const firstDow = (first.getDay() + 6) % 7; // 0=PO,6=NE
  const daysInMonth = last.getDate();

  const grid: { date: Date; inMonth: boolean }[] = [];
  // dni z predchádzajúceho mesiaca
  for (let i = 0; i < firstDow; i++) {
    const d = new Date(year, m0, 1 - (firstDow - i));
    grid.push({ date: d, inMonth: false });
  }
  // aktuálny mesiac
  for (let d = 1; d <= daysInMonth; d++) {
    grid.push({ date: new Date(year, m0, d), inMonth: true });
  }
  // doplň do 42 (6x7)
  while (grid.length < 42) {
    const lastCell = grid[grid.length - 1].date;
    grid.push({ date: new Date(lastCell.getFullYear(), lastCell.getMonth(), lastCell.getDate() + 1), inMonth: false });
  }
  return grid;
}

export default function CalendarMonth({
  year,
  month,
  itemsByDay,
  onPrevMonth,
  onNextMonth,
  onOpenActivity,
  className = "",
}: Props) {
  const grid = React.useMemo(() => buildGrid(year, month), [year, month]);
  const monthName = new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long" }); // title: November, ...

  return (
    <div
      className={[
        "rounded-2xl shadow-lg border border-white/10",
        "bg-white/90 dark:bg-gray-900/70 backdrop-blur",
        "p-3 sm:p-4",
        className,
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-xl font-bold tracking-tight">{monthName} {year}</div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" circle onClick={onPrevMonth} aria-label="Predchádzajúci mesiac">←</Button>
          <Button size="sm" variant="ghost" circle onClick={onNextMonth} aria-label="Ďalší mesiac">→</Button>
        </div>
      </div>

      {/* Week header */}
      <div className="grid grid-cols-7 gap-1 text-center text-xs opacity-70 mb-1">
        {WEEK_HDR.map((w) => (
          <div key={w} className="py-1">{w}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {grid.map(({ date, inMonth }, i) => {
          const key = ymd(date);
          const items = itemsByDay[key] || [];
          const isToday = key === ymd(new Date());
          return (
            <div
              key={key + ":" + i}
              className={[
                "rounded-xl p-2 min-h-[64px] flex flex-col",
                inMonth ? "bg-white/3 dark:bg-white/5" : "bg-transparent opacity-40",
                "border border-white/10",
                isToday ? "outline outline-1 outline-white/25" : "",
              ].join(" ")}
            >
              <div className="text-xs opacity-80 mb-1">{date.getDate()}</div>

              {/* Dots / items */}
              {items.length === 0 ? (
                <div className="flex-1" />
              ) : (
                <ul className="space-y-1">
                  {items.slice(0, 2).map((a) => (
                    <li key={a.id}>
                      <button
                        onClick={() => onOpenActivity?.(a.id)}
                        className={[
                          "w-full text-left truncate",
                          "px-2 py-1 rounded-lg",
                          "bg-white/8 hover:bg-white/12",
                          "text-[11px] font-medium",
                          "transition-colors",
                        ].join(" ")}
                        title={a.name}
                      >
                        {a.name}
                      </button>
                    </li>
                  ))}
                  {items.length > 2 && (
                    <li className="text-[10px] opacity-70 px-2">+{items.length - 2} more</li>
                  )}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}