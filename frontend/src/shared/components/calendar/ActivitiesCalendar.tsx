// src/shared/components/ActivitiesCalendar.tsx
/*
"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useActivityData } from "@/shared/components/dataProviders/ActivityDataProvider";

// lazy, klientsky-only overlay (eliminuje #310 z SSR)
const ActivityDetailOverlay = dynamic(
  () => import("@/shared/components/ActivityDetailOverlay"),
  { ssr: false }
);

// dočasné farby športov (prepojíme neskôr na THEME / prefs)
const SPORT_COLORS: Record<string, string> = {
  run: "#22c55e",
  ride: "#38bdf8",
  swim: "#60a5fa",
  strength: "#f59e0b",
  mixed: "#a78bfa",
  skate: "#f472b6",
  other: "#9ca3af",
};

type DayCellData = {
  iso: string;
  inMonth: boolean;
  day: number | null;
  items: { id: number; sport: string; name: string }[];
};

function daysInMonth(y: number, m0: number) { return new Date(y, m0 + 1, 0).getDate(); }
function pad2(n: number) { return n < 10 ? `0${n}` : String(n); }
function iso(y: number, m0: number, d: number) { return `${y}-${pad2(m0 + 1)}-${pad2(d)}`; }
function startWeekday(y: number, m0: number) { return (new Date(y, m0, 1).getDay() + 6) % 7; } // Po=0

function useMonthActivities(year: number, month0: number) {
  const { rows } = useActivityData();
  const [map, setMap] = React.useState<Record<string, DayCellData>>({});

  React.useEffect(() => {
    const totalCells = 42;
    const offset = startWeekday(year, month0);
    const firstCell = new Date(year, month0, 1 - offset);
    const grid: Record<string, DayCellData> = {};

    for (let i = 0; i < totalCells; i++) {
      const d = new Date(firstCell); d.setDate(firstCell.getDate() + i);
      const k = iso(d.getFullYear(), d.getMonth(), d.getDate());
      const inMonth = d.getMonth() === month0;
      grid[k] = { iso: k, inMonth, day: inMonth ? d.getDate() : null, items: [] };
    }

    const firstIso = iso(year, month0, 1);
    const lastIso = iso(year, month0, daysInMonth(year, month0));
    for (const r of rows) {
      const dIso = r.date.slice(0, 10);
      if (dIso < firstIso || dIso > lastIso) continue;
      const cell = grid[dIso];
      if (!cell) continue;
      cell.items.push({ id: r.activity_id, sport: r.sport_type_fe || "other", name: r.name || "" });
    }
    setMap(grid);
  }, [rows, year, month0]);

  return map;
}

function SportDot({ color, title, onClick }: { color: string; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-block w-2 h-2 rounded-full focus:outline-none focus:ring-2 focus:ring-white/30"
      style={{ backgroundColor: color }}
      aria-label={title}
    />
  );
}

function DayCell({ cell, onOpen }: { cell: DayCellData; onOpen: (id: number) => void }) {
  const base = "rounded-2xl border border-white/10 bg-white/5 dark:bg-black/20";
  const muted = cell.inMonth ? "" : "opacity-40";
  return (
    <div className={`p-2 ${base} ${muted}`}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">{cell.day ?? ""}</div>
        <div className="flex items-center gap-1">
          {cell.items.slice(0, 5).map((it) => (
            <SportDot
              key={it.id}
              color={SPORT_COLORS[it.sport] ?? SPORT_COLORS.other}
              title={it.name || it.sport}
              onClick={() => onOpen(it.id)}
            />
          ))}
          {cell.items.length > 5 && (
            <span className="text-[10px] opacity-70">+{cell.items.length - 5}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ActivitiesCalendar({ year: yy, month: mm }: { year?: number; month?: number }) {
  const today = new Date();
  const [year, setYear] = React.useState(yy ?? today.getFullYear());
  const [month0, setMonth0] = React.useState(mm ?? today.getMonth());
  const [detailId, setDetailId] = React.useState<number | null>(null);

  const map = useMonthActivities(year, month0);

  const cells = React.useMemo(() => {
    const out: DayCellData[] = [];
    const offset = startWeekday(year, month0);
    const firstCell = new Date(year, month0, 1 - offset);
    for (let i = 0; i < 42; i++) {
      const d = new Date(firstCell); d.setDate(firstCell.getDate() + i);
      const k = iso(d.getFullYear(), d.getMonth(), d.getDate());
      out.push(map[k] ?? { iso: k, inMonth: d.getMonth() === month0, day: d.getMonth() === month0 ? d.getDate() : null, items: [] });
    }
    return out;
  }, [map, year, month0]);

  const prev = () => { const d = new Date(year, month0, 1); d.setMonth(d.getMonth() - 1); setYear(d.getFullYear()); setMonth0(d.getMonth()); };
  const next = () => { const d = new Date(year, month0, 1); d.setMonth(d.getMonth() + 1); setYear(d.getFullYear()); setMonth0(d.getMonth()); };

  const label = new Date(year, month0, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={prev} className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20" aria-label="Previous month">←</button>
        <div className="ml-1 mr-1 text-lg font-semibold">{label}</div>
        <button onClick={next} className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20" aria-label="Next month">→</button>
      </div>

      <div className="grid grid-cols-7 gap-2 text-[11px] uppercase tracking-wide opacity-70">
        {["p","u","s","š","p","s","n"].map((d) => <div key={d} className="text-center">{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {cells.map((c) => (
          <DayCell key={c.iso} cell={c} onOpen={(id) => setDetailId(id)} />
        ))}
      </div>

      {detailId != null && (
        <ActivityDetailOverlay activityId={detailId} open={true} onClose={() => setDetailId(null)} />
      )}
    </div>
  );
}
  */