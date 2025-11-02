// src/features/widgets/WidgetActivitiesCalendar.tsx
"use client";

import * as React from "react";
import WidgetCard from "@/shared/components/ui/WidgetCard";
import { useActivityData } from "@/shared/components/dataProviders/ActivityDataProvider";
import ActivityTable from "@/shared/components/ActivityTable";
import { THEME } from "@/shared/theme/tokens";

const SPORT_COLORS: Record<string, string> = {
  run:      (THEME as any)?.sport?.run ?? THEME.chart.run,
  ride:     (THEME as any)?.sport?.ride ?? THEME.chart.ride,
  swim:     (THEME as any)?.sport?.swim ?? THEME.chart.swim,
  strength: (THEME as any)?.sport?.strength ?? THEME.chart.strength,
  mixed:    (THEME as any)?.sport?.mixed ?? THEME.chart.mixed,
  skate:    (THEME as any)?.sport?.skate ?? THEME.chart.skate,
  walk:     (THEME as any)?.sport?.walk ?? THEME.chart.walk,
  other:    (THEME as any)?.sport?.other ?? THEME.chart.other,
};

/* ---------------- date helpers ---------------- */
const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));
const iso  = (y: number, m0: number, d: number) => `${y}-${pad2(m0 + 1)}-${pad2(d)}`;
const dim  = (y: number, m0: number) => new Date(y, m0 + 1, 0).getDate();
// Po=0..Ne=6 (Apple-like)
const startDow = (y: number, m0: number) => (new Date(y, m0, 1).getDay() + 6) % 7;

type DayCell = {
  iso: string;
  inMonth: boolean;
  num: number | null;
  items: { id: number; sport: string; name: string }[];
};

export default function WidgetActivitiesCalendar() {
  const { rows } = useActivityData();

  const today = new Date();
  const [year, setYear] = React.useState(today.getFullYear());
  const [month0, setMonth0] = React.useState(today.getMonth());
  const [selectedIso, setSelectedIso] = React.useState<string | null>(null);

  const monthLabel = new Date(year, month0, 1).toLocaleDateString("sk-SK", {
    month: "long",
    year: "numeric",
  });

  const cells: DayCell[] = React.useMemo(() => {
    const total = 42;
    const offset = startDow(year, month0);
    const firstCell = new Date(year, month0, 1 - offset);

    const arr: DayCell[] = [];
    for (let i = 0; i < total; i++) {
      const d = new Date(firstCell);
      d.setDate(firstCell.getDate() + i);
      const inMonth = d.getMonth() === month0;
      arr.push({
        iso: iso(d.getFullYear(), d.getMonth(), d.getDate()),
        inMonth,
        num: inMonth ? d.getDate() : null,
        items: [],
      });
    }

    const firstIso = iso(year, month0, 1);
    const lastIso  = iso(year, month0, dim(year, month0));
    const map = new Map(arr.map(c => [c.iso, c]));

    for (const r of rows) {
      const dIso = r.date.slice(0, 10);
      if (dIso < firstIso || dIso > lastIso) continue;
      const c = map.get(dIso);
      if (!c) continue;
      c.items.push({
        id: r.activity_id,
        sport: (r as any).sport || "other",
        name: r.name || "",
      });
    }
    return arr;
  }, [rows, year, month0]);

  const go = (delta: number) => {
    const d = new Date(year, month0, 1);
    d.setMonth(d.getMonth() + delta);
    setYear(d.getFullYear());
    setMonth0(d.getMonth());
    setSelectedIso(null);
  };

  return (
    <WidgetCard
      title={monthLabel}
      // žiadny onOpen – toto je “statický” widget
      interactive={false}
      accent="bg-slate-700"
      minH={220}
    >
      {/* Navigácia mesiaca */}
      <div className="flex items-center justify-center gap-3 mb-2">
        <button
          onClick={() => go(-1)}
          className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center"
          aria-label="Predchádzajúci mesiac"
        >
          ←
        </button>
        <div className="text-sm opacity-75">{monthLabel}</div>
        <button
          onClick={() => go(+1)}
          className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center"
          aria-label="Ďalší mesiac"
        >
          →
        </button>
      </div>

      {/* Headery dní */}
      <div className="grid grid-cols-7 gap-2 text-[11px] uppercase tracking-wide opacity-70 mb-1">
        {["p","u","s","š","p","s","n"].map((d) => (
          <div key={d} className="text-center">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-2">
        {cells.map((c) => {
          const selected = selectedIso === c.iso;
          return (
            <div
              key={c.iso}
              className={[
                "p-2 rounded-2xl border border-white/10",
                "bg-white/5 dark:bg-black/20",
                c.inMonth ? "" : "opacity-40",
                selected ? "ring-2 ring-emerald-500/60" : "",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <button
                  className={[
                    "h-7 w-7 rounded-full grid place-items-center",
                    "bg-white/10 hover:bg-white/20",
                    selected ? "ring-2 ring-white/30" : "",
                    "text-sm font-semibold",
                  ].join(" ")}
                  onClick={() => setSelectedIso((s) => (s === c.iso ? null : c.iso))}
                  aria-label={c.iso}
                >
                  {c.num ?? ""}
                </button>

                <div className="flex items-center gap-1">
                  {c.items.slice(0, 5).map((it) => (
                    <span
                      key={it.id}
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: SPORT_COLORS[it.sport] ?? SPORT_COLORS.other }}
                    />
                  ))}
                  {c.items.length > 5 && (
                    <span className="text-[10px] opacity-70">+{c.items.length - 5}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabuľka pod widgetom po výbere dňa */}
      {selectedIso && (
        <div className="mt-4">
          <ActivityTable start={selectedIso} end={selectedIso} />
        </div>
      )}
    </WidgetCard>
  );
}