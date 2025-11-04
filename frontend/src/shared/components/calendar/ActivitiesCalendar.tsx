"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useActivityData } from "@/shared/components/dataProviders/ActivityDataProvider";
import { THEME } from "@/shared/theme/tokens";
import Button from "@/shared/components/ui/Button";

const ActivityTable = dynamic(
  () => import("@/shared/components/ActivityTable"),
  { ssr: false }
);

const SPORT_COLORS: Record<string, string> = {
  run: THEME.chart.run,
  ride: THEME.chart.ride,
  swim: THEME.chart.swim,
  strength: THEME.chart.strength,
  mixed: THEME.chart.mixed,
  skate: THEME.chart.skate,
  walk: THEME.chart.walk,
  other: THEME.chart.other,
};

type DayCellData = {
  iso: string;
  inMonth: boolean;
  day: number | null;
  items: { id: number; sport: string; name: string }[];
};

function daysInMonth(y: number, m0: number) { return new Date(y, m0 + 1, 0).getDate(); }
const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));
const iso  = (y: number, m0: number, d: number) => `${y}-${pad2(m0 + 1)}-${pad2(d)}`;
const startWeekday = (y: number, m0: number) => (new Date(y, m0, 1).getDay() + 6) % 7; // Po=0

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
    const lastIso  = iso(year, month0, daysInMonth(year, month0));
    for (const r of rows) {
      const dIso = r.date.slice(0, 10);
      if (dIso < firstIso || dIso > lastIso) continue;
      const cell = grid[dIso];
      if (!cell) continue;
      cell.items.push({
        id: r.activity_id,
        sport: (r as any).sport || (r as any).sport_type_fe || "other",
        name: r.name || "",
      });
    }
    setMap(grid);
  }, [rows, year, month0]);

  return map;
}

function DayCell({
  cell,
  onSelect,
  isSelected,
}: {
  cell: DayCellData;
  onSelect: (iso: string) => void;
  isSelected: boolean;
}) {
  const muted = cell.inMonth ? "" : "opacity-40";
  return (
    <button
      type="button"
      onClick={() => onSelect(cell.iso)}
      className={[
        "px-2 py-1.5 text-left w-full focus:outline-none",
        "rounded-xl border border-white/10 overflow-hidden",
        "bg-white/5 dark:bg-black/20",
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
          {cell.items.slice(0, 8).map((it) => (
            <span
              key={it.id}
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: SPORT_COLORS[it.sport] ?? SPORT_COLORS.other }}
              title={it.name || it.sport}
            />
          ))}
          {cell.items.length > 8 && (
            <span className="text-[10px] opacity-70">+{cell.items.length - 8}</span>
          )}
        </div>
      </div>
    </button>
  );
}

export default function ActivitiesCalendar({
  year: yy,
  month: mm,
}: {
  year?: number;
  month?: number;
}) {
  const today = new Date();
  const [year, setYear] = React.useState(yy ?? today.getFullYear());
  const [month0, setMonth0] = React.useState(mm ?? today.getMonth());
  const [selectedIso, setSelectedIso] = React.useState<string | null>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSelectedIso(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const map = useMonthActivities(year, month0);

  const cells = React.useMemo(() => {
    const out: DayCellData[] = [];
    const offset = startWeekday(year, month0);
    const firstCell = new Date(year, month0, 1 - offset);
    for (let i = 0; i < 42; i++) {
      const d = new Date(firstCell); d.setDate(firstCell.getDate() + i);
      const k = iso(d.getFullYear(), d.getMonth(), d.getDate());
      out.push(
        map[k] ?? {
          iso: k,
          inMonth: d.getMonth() === month0,
          day: d.getMonth() === month0 ? d.getDate() : null,
          items: [],
        }
      );
    }
    return out;
  }, [map, year, month0]);

  const jump = (dir: -1 | 1) => {
    const d = new Date(year, month0, 1);
    d.setMonth(d.getMonth() + dir);
    setYear(d.getFullYear());
    setMonth0(d.getMonth());
    setSelectedIso(null);
  };

  const label = new Date(year, month0, 1).toLocaleDateString("sk-SK", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-3">
      {/* HLAVIČKA */}
      <div className="p-3 rounded-2xl shadow-lg border border-white/10 bg-white/90 dark:bg-gray-900/70 backdrop-blur">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Kalendár aktivít</h2>
          <div className="flex items-center gap-2 translate-y-[2px]">
            <Button variant="ghost" size="sm" circle aria-label="Predchádzajúci mesiac" onClick={() => jump(-1)}>‹</Button>
            <div className="mx-1 text-base font-semibold min-w-[160px] text-center">{label}</div>
            <Button variant="ghost" size="sm" circle aria-label="Nasledujúci mesiac" onClick={() => jump(1)}>›</Button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-2 text-[11px] uppercase tracking-wide opacity-70">
          {["p","u","s","š","p","s","n"].map((d) => (
            <div key={d} className="text-center">{d}</div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-2">
          {cells.map((c) => (
            <DayCell
              key={c.iso}
              cell={c}
              isSelected={selectedIso === c.iso}
              onSelect={(iso) => setSelectedIso((cur) => (cur === iso ? null : iso))}
            />
          ))}
        </div>
      </div>

      {/* DETAIL – odsadený od vrchu aj zľava, žiadne extra vnútorné panely */}
      {selectedIso && (
        <div className="mt-3 ml-1">
          <ActivityTable start={selectedIso} end={selectedIso} />
        </div>
      )}
    </div>
  );
}