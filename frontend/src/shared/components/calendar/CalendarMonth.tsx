"use client";

import React from "react";
import Button from "@/shared/components/ui/Button";

/* -------- Farby športov (dočasne natvrdo) --------
   Neskôr nahradíš za THEME / user-prefs. */
const SPORT_COLORS: Record<string, string> = {
  run: "#22c55e",        // emerald-500
  ride: "#38bdf8",       // sky-400
  bike: "#38bdf8",
  cycling: "#38bdf8",
  swim: "#60a5fa",       // blue-400
  strength: "#f59e0b",   // amber-500
  mixed: "#a78bfa",      // violet-400
  skate: "#f472b6",      // pink-400
  hike: "#34d399",       // green-400
  walk: "#9ca3af",       // gray-400
  other: "#94a3b8",      // slate-400
};
function colorForSport(s?: string) {
  if (!s) return SPORT_COLORS.other;
  const key = String(s).toLowerCase();
  return SPORT_COLORS[key] ?? SPORT_COLORS.other;
}

/* -------- Typy -------- */
export type CalActivity = {
  id: number;
  name: string;
  date: string;  // YYYY-MM-DD
  sport?: string;
};

type Props = {
  year: number;     // 2025
  month: number;    // 1..12
  itemsByDay: Record<string, CalActivity[]>;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  onOpenActivity?: (id: number) => void;
};

/* -------- Pomocné -------- */
const WEEKDAYS = ["p", "u", "s", "š", "p", "s", "n"]; // sk skratky, ako v iOS sc
function firstWeekdayIndex(y: number, m1: number) {
  // Po=0..Ne=6
  const js = new Date(y, m1 - 1, 1).getDay(); // Ne=0..So=6
  return (js + 6) % 7;
}
function daysInMonth(y: number, m1: number) {
  return new Date(y, m1, 0).getDate();
}
function pad2(n: number) { return n < 10 ? `0${n}` : String(n); }

/* -------- UI komponent -------- */
export default function CalendarMonth({
  year, month, itemsByDay,
  onPrevMonth, onNextMonth, onOpenActivity,
}: Props) {
  const startPad = firstWeekdayIndex(year, month);
  const count = daysInMonth(year, month);
  const cells: Array<{ day?: number; iso?: string }> = [];
  for (let i = 0; i < startPad; i++) cells.push({});
  for (let d = 1; d <= count; d++) {
    const iso = `${year}-${pad2(month)}-${pad2(d)}`;
    cells.push({ day: d, iso });
  }
  // zarovnanie na násobok 7
  while (cells.length % 7 !== 0) cells.push({});

  const todayIso = new Date().toISOString().slice(0, 10);

  const title = new Date(year, month - 1, 1).toLocaleDateString("sk-SK", {
    month: "long", year: "numeric",
  });

  return (
    <section
      className={[
        "rounded-2xl shadow-lg border border-white/10",
        "bg-white/90 dark:bg-gray-900/70 backdrop-blur",
        "p-3 sm:p-4",
      ].join(" ")}
    >
      {/* header */}
      <div className="flex items-center gap-2 mb-3">
        <Button variant="ghost" size="sm" circle onClick={onPrevMonth} aria-label="Predchádzajúci mesiac">
          ‹
        </Button>
        <div className="flex-1 text-center font-semibold tracking-tight text-lg">
          {title.charAt(0).toUpperCase() + title.slice(1)}
        </div>
        <Button variant="ghost" size="sm" circle onClick={onNextMonth} aria-label="Ďalší mesiac">
          ›
        </Button>
      </div>

      {/* header dni */}
      <div className="grid grid-cols-7 gap-1 text-xs opacity-70 mb-1 select-none">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center">{w}</div>
        ))}
      </div>

      {/* mriežka dní */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          const dayItems = c.iso ? (itemsByDay[c.iso] ?? []) : [];
          const isToday = c.iso === todayIso;

          return (
            <div
              key={i}
              className={[
                "min-h-[64px] rounded-xl",
                "bg-black/10 dark:bg-white/5",
                "border border-white/10",
                "px-1.5 py-1.5",
                c.day ? "opacity-100" : "opacity-40",
                "flex flex-col",
              ].join(" ")}
            >
              {/* číslo dňa */}
              <div className="flex items-center justify-between">
                <div className={[
                  "text-sm font-semibold tabular-nums",
                  isToday ? "px-2 py-0.5 rounded-full bg-white/15" : "",
                ].join(" ")}>
                  {c.day ?? ""}
                </div>

                {/* malé bodky podľa počtu aktivít */}
                {dayItems.length > 0 && (
                  <div className="flex gap-1">
                    {dayItems.slice(0, 3).map((a) => (
                      <span
                        key={a.id}
                        className="inline-block w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: colorForSport(a.sport) }}
                        title={a.name}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* zoznam mien (max 2), kliknutelné */}
              <div className="mt-1 space-y-0.5">
                {dayItems.slice(0, 2).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => onOpenActivity?.(a.id)}
                    className="w-full truncate text-left text-[11px] px-1 py-[2px] rounded"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.05)",
                      border: `1px solid rgba(255,255,255,0.08)`,
                    }}
                    title={a.name}
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-1 align-middle"
                      style={{ backgroundColor: colorForSport(a.sport) }}
                    />
                    <span className="align-middle">{a.name}</span>
                  </button>
                ))}
                {dayItems.length > 2 && (
                  <div className="text-[10px] opacity-60 px-1">+{dayItems.length - 2} ďalšie…</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}