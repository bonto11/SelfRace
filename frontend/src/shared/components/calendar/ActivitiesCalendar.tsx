// src/shared/components/ActivitiesCalendar.tsx
"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useActivityData } from "@/shared/components/dataProviders/ActivityDataProvider";
import { THEME } from "@/shared/theme/tokens";
import Button from "@/shared/components/ui/Button";
import { PANEL, PANEL_HEADER, SOFT_CELL } from "@/shared/ui/classes";

const ActivityTable = dynamic(() => import("@/shared/components/ActivityTable"), { ssr: false });

const SPORT_COLORS: Record<string, string> = {
  run:      THEME.chart.run,
  ride:     THEME.chart.ride,
  swim:     THEME.chart.swim,
  strength: THEME.chart.strength,
  mixed:    THEME.chart.mixed,
  skate:    THEME.chart.skate,
  walk:     THEME.chart.walk,
  other:    THEME.chart.other,
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
    const total = 42;
    const offset = startWeekday(year, month0);
    const firstCell = new Date(year, month0, 1 - offset);
    const grid: Record<string, DayCellData> = {};

    for (let i = 0; i < total; i++) {
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

function SportDot({ color, title }: { color: string; title: string }) {
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full"
      style={{ backgroundColor: color }}
      title={title}
      aria-label={title}
    />
  );
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
        "w-full text-left px-2 py-1.5 select-none focus:outline-none",
        SOFT_CELL,
        muted,
        "min-h-[60px]",
        isSelected ? "ring-2 ring-emerald-500/60" : "hover:bg-white/50 dark:hover:bg-black/30",
      ].join(" ")}
      aria-pressed={isSelected}
    >
      <div className="flex flex-col">
        {/* číslo dňa – bez badge pozadia, viac doľava */}
        <span className="text-sm font-semibold leading-none tracking-tight ml-0.5 mt-0.5">
          {cell.day ?? ""}
        </span>

        {/* bodky POD číslom */}
        <div className="mt-2 pl-0.5 pr-0.5 flex flex-wrap gap-1 items-center">
          {cell.items.slice(0, 8).map((it) => (
            <SportDot
              key={it.id}
              color={SPORT_COLORS[it.sport] ?? SPORT_COLORS.other}
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

export default function ActivitiesCalendar({ year: yy, month: mm }: { year?: number; month?: number }) {
  const today = new Date();
  const [year, setYear] = React.useState(yy ?? today.getFullYear());
  const [month0, setMonth0] = React.useState(mm ?? today.getMonth());
  const [selectedIso, setSelectedIso] = React.useState<string | null>(null);

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

  const goto = (delta: number) => {
    const d = new Date(year, month0, 1);
    d.setMonth(d.getMonth() + delta);
    setYear(d.getFullYear());
    setMonth0(d.getMonth());
    setSelectedIso(null);
  };

  const label = new Date(year, month0, 1).toLocaleDateString("sk-SK", {
    month: "long",
    year: "numeric",
  });
  const niceDate = (s: string) =>
    new Date(s).toLocaleDateString("sk-SK", { weekday: "short", day: "2-digit", month: "short" });

  return (
    <section className={PANEL}>
      {/* Header – mesiac vľavo, navigácia VPRAVO a mierne nižšie */}
      <header className={[PANEL_HEADER, "pt-4"].join(" ")}>
        <h3 className="text-base font-semibold">Kalendár aktivít</h3>
        <div className="flex items-center gap-2 mt-2">
          <div className="text-sm font-medium mr-2">{label}</div>
          <Button variant="ghost" size="sm" circle aria-label="Predchádzajúci mesiac" onClick={() => goto(-1)}>
            ‹
          </Button>
          <Button variant="ghost" size="sm" circle aria-label="Nasledujúci mesiac" onClick={() => goto(+1)}>
            ›
          </Button>
        </div>
      </header>

      <div className="px-4 pb-4">
        {/* skratky dní */}
        <div className="grid grid-cols-7 gap-2 text-[11px] uppercase tracking-wide opacity-70 mb-2">
          {["p","u","s","š","p","s","n"].map((d) => (
            <div key={d} className="text-center">{d}</div>
          ))}
        </div>

        {/* mriežka dní */}
        <div className="grid grid-cols-7 gap-2">
          {cells.map((c) => (
            <DayCell
              key={c.iso}
              cell={c}
              onSelect={(iso) => setSelectedIso((cur) => (cur === iso ? null : iso))}
              isSelected={selectedIso === c.iso}
            />
          ))}
        </div>

        {/* detail dňa = tvoja ActivityTable */}
        {selectedIso && (
          <div className="mt-4 rounded-2xl border border-white/10 p-3 bg-white/90 dark:bg-gray-900/70 backdrop-blur">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold">Aktivity — {niceDate(selectedIso)}</h4>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIso(null)}>
                Zavrieť
              </Button>
            </div>
            <ActivityTable start={selectedIso} end={selectedIso} />
          </div>
        )}
      </div>
    </section>
  );
}