// src/shared/components/ActivitiesCalendar.tsx
"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useActivityData } from "@/shared/components/dataProviders/ActivityDataProvider";
import { THEME } from "@/shared/theme/tokens";
import Button from "@/shared/components/ui/Button";  // ← tvoje tlačidlo

const ActivityDetailOverlay = dynamic(
  () => import("@/shared/components/ActivityDetailOverlay"),
  { ssr: false }
);

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

function SportDot({
  color,
  title,
  onClick,
}: {
  color: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-block w-1.5 h-1.5 rounded-full focus:outline-none"
      style={{ backgroundColor: color }}
      aria-label={title}
    />
  );
}

function DayCell({ cell, onOpen }: { cell: DayCellData; onOpen: (id: number) => void }) {
  // iba rámik bunky; vnútro transparent
  const base = "relative overflow-hidden rounded-xl border border-white/10 bg-transparent";
  const muted = cell.inMonth ? "" : "opacity-40";

  return (
    <div className={`px-2 py-1.5 ${base} ${muted}`}>
      <div className="flex items-center justify-between">
        {/* číslo bez badge, viac doľava */}
        <span className="day-number text-sm font-semibold tracking-tight ml-0.5">
          {cell.day ?? ""}
        </span>

        {/* športové bodky napravo */}
        <div className="flex items-center gap-1.5 pr-0.5">
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

  const label = new Date(year, month0, 1).toLocaleDateString("sk-SK", { month: "long", year: "numeric" });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" circle aria-label="Predchádzajúci mesiac" onClick={prev}>
          ‹
        </Button>
        <div className="ml-1 mr-1 text-lg font-semibold">{label}</div>
        <Button variant="ghost" size="sm" circle aria-label="Nasledujúci mesiac" onClick={next}>
          ›
        </Button>
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