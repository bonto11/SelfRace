"use client";

import * as React from "react";
import { useActivityData } from "@/shared/components/dataProviders/ActivityDataProvider";
import ActivityDetailOverlay from "@/shared/components/ActivityDetailOverlay";

// ----- dočasné farby športov (neskôr z THEME / user-prefs) -----
const SPORT_COLORS: Record<string, string> = {
  run: "#22c55e",       // emerald-500
  ride: "#38bdf8",      // sky-400
  swim: "#60a5fa",      // blue-400
  strength: "#f59e0b",  // amber-500
  mixed: "#a78bfa",     // violet-400
  skate: "#f472b6",     // pink-400
  other: "#9ca3af",     // gray-400
};

// ------------------ utils (bez hookov) ------------------
function daysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}
function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}
function dateISO(y: number, m: number, d: number) {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`;
}
function startWeekday(y: number, m: number) {
  // 0=Mon … 6=Sun (aby to pasovalo k EU poradiu)
  const wd = new Date(y, m, 1).getDay(); // 0=Sun..6=Sat
  return (wd + 6) % 7;
}

// ------------------ typy ------------------
type DayCellData = {
  iso: string;                     // "YYYY-MM-DD"
  inMonth: boolean;
  day: number | null;              // číslo dňa (ak je inMonth)
  items: { id: number; name: string; sport: string }[];
};

// ------------- custom hook: mesačné dáta -----------------
function useMonthActivities(year: number, month0: number) {
  const { rows } = useActivityData();
  const [map, setMap] = React.useState<Record<string, DayCellData>>({});

  React.useEffect(() => {
    const firstIso = dateISO(year, month0, 1);
    const lastIso = dateISO(year, month0, daysInMonth(year, month0));

    // predpripravíme rámec mriežky vrátane "prázdnych" pred/po mesiaci
    const grid: Record<string, DayCellData> = {};
    const offset = startWeekday(year, month0);
    const count = daysInMonth(year, month0);

    // range pre grid: 6 týždňov = 42 buniek (stabilné rozloženie)
    const totalCells = 42;
    // prvý zobrazovaný deň (mimo mesiaca)
    const firstDate = new Date(year, month0, 1 - offset);

    for (let i = 0; i < totalCells; i++) {
      const d = new Date(firstDate);
      d.setDate(firstDate.getDate() + i);
      const inMonth = d.getMonth() === month0;
      const iso = dateISO(d.getFullYear(), d.getMonth(), d.getDate());
      grid[iso] = {
        iso,
        inMonth,
        day: inMonth ? d.getDate() : null,
        items: [],
      };
    }

    // naplníme aktivity (len tie, čo spadajú do mesiaca)
    for (const r of rows) {
      const iso = r.date.slice(0, 10);
      if (iso < firstIso || iso > lastIso) continue;
      const cell = grid[iso];
      if (!cell) continue;
      cell.items.push({
        id: r.activity_id,
        name: r.name || "(no name)",
        sport: r.sport_type_fe || "other",
      });
    }

    setMap(grid);
  }, [rows, year, month0]);

  return map;
}

// ------------------ UI komponenty ------------------
function Dot({ color }: { color: string }) {
  return (
    <span
      className="inline-block rounded-full w-1.5 h-1.5"
      style={{ backgroundColor: color }}
    />
  );
}

function DayCell({
  data,
  onPickActivity,
}: {
  data: DayCellData;
  onPickActivity: (activityId: number) => void;
}) {
  const border =
    "rounded-2xl border border-white/10 bg-white/5 dark:bg-black/20";
  const muted = "opacity-40";
  return (
    <div className={`p-2 ${border} ${data.inMonth ? "" : muted}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-semibold">
          {data.day ?? ""}
        </div>
        {/* bodky športov (max 4 nech to nehučí) */}
        <div className="flex items-center gap-1">
          {data.items.slice(0, 4).map((it, i) => (
            <Dot
              key={i}
              color={SPORT_COLORS[it.sport] ?? SPORT_COLORS.other}
            />
          ))}
          {data.items.length > 4 && (
            <span className="text-[10px] opacity-70">+{data.items.length - 4}</span>
          )}
        </div>
      </div>

      {/* zoznam aktivít (názvy) */}
      <div className="space-y-1">
        {data.items.map((it) => (
          <button
            key={it.id}
            onClick={() => onPickActivity(it.id)}
            className="w-full text-left px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10
                       focus:outline-none focus:ring-2 focus:ring-white/20 truncate"
            title={it.name}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full mr-2 align-middle"
              style={{ backgroundColor: SPORT_COLORS[it.sport] ?? SPORT_COLORS.other }}
            />
            <span className="align-middle text-xs">{it.name}</span>
          </button>
        ))}

        {data.inMonth && data.items.length === 0 && (
          <div className="text-[11px] opacity-50 px-1 py-1">—</div>
        )}
      </div>
    </div>
  );
}

// ------------------ Hlavný kalendár ------------------
export default function ActivitiesCalendar({
  year: y0,
  month: m0, // 0-index (0=Jan)
}: {
  year?: number;
  month?: number;
}) {
  const today = new Date();
  const [year, setYear] = React.useState<number>(y0 ?? today.getFullYear());
  const [month0, setMonth0] = React.useState<number>(m0 ?? today.getMonth());
  const [detailId, setDetailId] = React.useState<number | null>(null);

  const map = useMonthActivities(year, month0);

  // grid 6×7 (42)
  const cells: DayCellData[] = React.useMemo(() => {
    const res: DayCellData[] = [];
    const offset = startWeekday(year, month0);
    const firstDate = new Date(year, month0, 1 - offset);
    for (let i = 0; i < 42; i++) {
      const d = new Date(firstDate);
      d.setDate(firstDate.getDate() + i);
      const iso = dateISO(d.getFullYear(), d.getMonth(), d.getDate());
      res.push(
        map[iso] ??
          {
            iso,
            inMonth: d.getMonth() === month0,
            day: d.getMonth() === month0 ? d.getDate() : null,
            items: [],
          }
      );
    }
    return res;
  }, [map, year, month0]);

  const prevMonth = () => {
    const d = new Date(year, month0, 1);
    d.setMonth(d.getMonth() - 1);
    setYear(d.getFullYear());
    setMonth0(d.getMonth());
  };
  const nextMonth = () => {
    const d = new Date(year, month0, 1);
    d.setMonth(d.getMonth() + 1);
    setYear(d.getFullYear());
    setMonth0(d.getMonth());
  };

  const monthLabel = new Date(year, month0, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-3">
      {/* header */}
      <div className="flex items-center gap-2">
        <button
          onClick={prevMonth}
          className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20"
          aria-label="Previous month"
        >
          ←
        </button>
        <div className="ml-1 mr-1 text-lg font-semibold">{monthLabel}</div>
        <button
          onClick={nextMonth}
          className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20"
          aria-label="Next month"
        >
          →
        </button>
      </div>

      {/* weekdays */}
      <div className="grid grid-cols-7 gap-2 text-[11px] uppercase tracking-wide opacity-70">
        {["p", "u", "s", "š", "p", "s", "n"].map((d) => (
          <div key={d} className="text-center">{d}</div>
        ))}
      </div>

      {/* grid */}
      <div className="grid grid-cols-7 gap-2">
        {cells.map((cell) => (
          <DayCell
            key={cell.iso}
            data={cell}
            onPickActivity={(id) => setDetailId(id)}
          />
        ))}
      </div>

      {/* detail overlay */}
      {detailId != null && (
        <ActivityDetailOverlay
          activityId={detailId}
          open={true}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}