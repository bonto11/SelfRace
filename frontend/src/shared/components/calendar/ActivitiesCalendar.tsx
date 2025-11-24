"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useActivityData } from "@/shared/components/dataProviders/ActivityDataProvider";
import { usePlanData } from "@/shared/components/dataProviders/PlanDataProvider";
import { THEME } from "@/shared/theme/tokens";
import Button from "@/shared/components/ui/Button";
import {
  CALENDAR_CONTAINER,
  CALENDAR_DAY_CELL,
  NO_X_OVERFLOW,
} from "@/shared/ui/classes";

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
  planned: { id: number; sport: string; title: string | null; duration_min: number | null }[];
};

function daysInMonth(y: number, m0: number) {
  return new Date(y, m0 + 1, 0).getDate();
}
const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));
const iso = (y: number, m0: number, d: number) =>
  `${y}-${pad2(m0 + 1)}-${pad2(d)}`;
// Po = 0
const startWeekday = (y: number, m0: number) =>
  (new Date(y, m0, 1).getDay() + 6) % 7;

function useMonthData(year: number, month0: number) {
  const { rows: actRows } = useActivityData();
  const { rows: planRows } = usePlanData();
  const [map, setMap] = React.useState<Record<string, DayCellData>>({});

  React.useEffect(() => {
    const totalCells = 42;
    const offset = startWeekday(year, month0);
    const firstCell = new Date(year, month0, 1 - offset);
    const grid: Record<string, DayCellData> = {};

    for (let i = 0; i < totalCells; i++) {
      const d = new Date(firstCell);
      d.setDate(firstCell.getDate() + i);
      const k = iso(d.getFullYear(), d.getMonth(), d.getDate());
      const inMonth = d.getMonth() === month0;
      grid[k] = {
        iso: k,
        inMonth,
        day: inMonth ? d.getDate() : null,
        items: [],
        planned: [],
      };
    }

    // reálne aktivity
    const firstIso = iso(year, month0, 1);
    const lastIso = iso(year, month0, daysInMonth(year, month0));
    for (const r of actRows) {
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

    // plán – ignoruj rest days (sport "other" a duration_min <= 0)
    for (const p of planRows) {
      const dIso = String(p.plan_date).slice(0, 10);
      if (dIso < firstIso || dIso > lastIso) continue;
      const sport = (p as any).sport || "other";
      const duration = p.duration_min ?? null;
      const isRest =
        sport === "other" ||
        duration === 0 ||
        (typeof (p as any).title === "string" &&
          /(rest|volno)/i.test((p as any).title));

      if (isRest) continue;

      const cell = grid[dIso];
      if (!cell) continue;
      cell.planned.push({
        id: p.id,
        sport,
        title: (p as any).title ?? (p as any).session_type ?? null,
        duration_min: duration,
      });
    }

    setMap(grid);
  }, [actRows, planRows, year, month0]);

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

  const dots: { key: string; sport: string }[] = [];
  for (const it of cell.items) {
    dots.push({ key: `a-${it.id}`, sport: it.sport });
  }
  for (const it of cell.planned) {
    dots.push({ key: `p-${it.id}`, sport: it.sport });
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
          {dots.slice(0, 8).map((it) => (
            <span
              key={it.key}
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor:
                  SPORT_COLORS[it.sport] ?? SPORT_COLORS.other,
              }}
            />
          ))}
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

  const { rows: planRows } = usePlanData();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedIso(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const map = useMonthData(year, month0);

  const cells = React.useMemo(() => {
    const out: DayCellData[] = [];
    const offset = startWeekday(year, month0);
    const firstCell = new Date(year, month0, 1 - offset);
    for (let i = 0; i < 42; i++) {
      const d = new Date(firstCell);
      d.setDate(firstCell.getDate() + i);
      const k = iso(d.getFullYear(), d.getMonth(), d.getDate());
      out.push(
        map[k] ?? {
          iso: k,
          inMonth: d.getMonth() === month0,
          day: d.getMonth() === month0 ? d.getDate() : null,
          items: [],
          planned: [],
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

  const selectedPlans = React.useMemo(() => {
    if (!selectedIso) return [];
    return planRows.filter(
      (p) => String(p.plan_date).slice(0, 10) === selectedIso
    );
  }, [planRows, selectedIso]);

  const selectedLabel = React.useMemo(() => {
    if (!selectedIso) return "";
    const d = new Date(selectedIso);
    return d.toLocaleDateString("sk-SK", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }, [selectedIso]);

  return (
    <div className={["space-y-3", NO_X_OVERFLOW].join(" ")}>
      {/* HLAVIČKA + mriežka */}
      <div className={[CALENDAR_CONTAINER, "p-3"].join(" ")}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Kalendár aktivít</h2>
          <div className="flex items-center gap-2 translate-y-[2px]">
            <Button
              variant="ghost"
              size="sm"
              circle
              aria-label="Predchádzajúci mesiac"
              onClick={() => jump(-1)}
            >
              ‹
            </Button>
            <div className="mx-1 text-base font-semibold min-w-[160px] text-center">
              {label}
            </div>
            <Button
              variant="ghost"
              size="sm"
              circle
              aria-label="Nasledujúci mesiac"
              onClick={() => jump(1)}
            >
              ›
            </Button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-2 text-[11px] uppercase tracking-wide opacity-70">
          {["p", "u", "s", "š", "p", "s", "n"].map((d) => (
            <div key={d} className="text-center">
              {d}
            </div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-2">
          {cells.map((c) => (
            <DayCell
              key={c.iso}
              cell={c}
              isSelected={selectedIso === c.iso}
              onSelect={(isoVal) =>
                setSelectedIso((cur) => (cur === isoVal ? null : isoVal))
              }
            />
          ))}
        </div>
      </div>

      {/* DETAIL pod kalendárom – pôvodný ActivityTable + plán zvlášť */}
      {selectedIso && (
        <div className="mt-3 ml-1 space-y-3">
          {/* pôvodný vzhľad a funkcionalita (klikateľné aktivity) */}
          <ActivityTable
            start={selectedIso}
            end={selectedIso}
            variant="calendar"
            suppressItemHeaderIfSingleDay
          />

          {/* plán na daný deň */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 px-3 py-2">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-sm font-semibold">
                Plánované tréningy — {selectedLabel}
              </h3>
            </div>
            {selectedPlans.length === 0 ? (
              <p className="text-sm opacity-70">
                Pre tento deň nie je vytvorený žiadny plán.
              </p>
            ) : (
              <ul className="mt-1 space-y-1.5">
                {selectedPlans.map((p) => {
                  const title =
                    (p as any).title ||
                    (p as any).session_type ||
                    "Tréning";
                  const duration =
                    p.duration_min != null ? `${p.duration_min} min` : "";
                  const sport =
                    (p as any).sport && SPORT_COLORS[(p as any).sport]
                      ? (p as any).sport
                      : "other";

                  return (
                    <li
                      key={p.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full"
                          style={{
                            backgroundColor:
                              SPORT_COLORS[sport] ?? SPORT_COLORS.other,
                          }}
                        />
                        <span>{title}</span>
                      </span>
                      {duration && (
                        <span className="text-xs opacity-70">
                          {duration}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}