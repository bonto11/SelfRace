"use client";

import * as React from "react";
import { useActivityData } from "@/shared/components/dataProviders/ActivityDataProvider";
import { usePlanData } from "@/shared/components/dataProviders/PlanDataProvider";
import { THEME } from "@/shared/theme/tokens";
import Button from "@/shared/components/ui/Button";
import {
  CALENDAR_CONTAINER,
  CALENDAR_DAY_CELL,
  NO_X_OVERFLOW,
} from "@/shared/ui/classes";

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
  hasActivity: boolean;
  hasPlan: boolean;
};

function daysInMonth(y: number, m0: number) {
  return new Date(y, m0 + 1, 0).getDate();
}
const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));
const iso = (y: number, m0: number, d: number) =>
  `${y}-${pad2(m0 + 1)}-${pad2(d)}`;
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
        hasActivity: false,
        hasPlan: false,
      };
    }

    const firstIso = iso(year, month0, 1);
    const lastIso = iso(year, month0, daysInMonth(year, month0));

    // aktivity
    for (const r of actRows) {
      const dIso = r.date.slice(0, 10);
      if (dIso < firstIso || dIso > lastIso) continue;
      const cell = grid[dIso];
      if (!cell) continue;
      cell.hasActivity = true;
    }

    // plán (bez REST)
    for (const p of planRows) {
      const dIso = String(p.plan_date).slice(0, 10);
      if (dIso < firstIso || dIso > lastIso) continue;
      const cell = grid[dIso];
      if (!cell) continue;

      const title = String(p.title || "").toLowerCase();
      const sType = String(p.session_type || "").toLowerCase();
      if (sType === "rest" || title.startsWith("rest")) continue;

      cell.hasPlan = true;
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

  // bodka za aktivity / plán – plán dáme mierne odlišnú (okraj)
  const dots: JSX.Element[] = [];
  if (cell.hasActivity) {
    dots.push(
      <span
        key="act"
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: SPORT_COLORS.run }}
      />
    );
  }
  if (cell.hasPlan) {
    dots.push(
      <span
        key="plan"
        className="inline-block w-1.5 h-1.5 rounded-full border border-emerald-400"
        style={{ backgroundColor: SPORT_COLORS.other }}
      />
    );
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
          {dots}
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
  const { selectByRange } = useActivityData();
  const { selectPlanByRange } = usePlanData();

  const today = new Date();
  const [year, setYear] = React.useState(yy ?? today.getFullYear());
  const [month0, setMonth0] = React.useState(mm ?? today.getMonth());
  const [selectedIso, setSelectedIso] = React.useState<string | null>(null);

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
          hasActivity: false,
          hasPlan: false,
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

  const dayLabel =
    selectedIso &&
    new Date(selectedIso).toLocaleDateString("sk-SK", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const dayActivities = React.useMemo(
    () =>
      selectedIso ? selectByRange(selectedIso, selectedIso) : [],
    [selectedIso, selectByRange]
  );

  const dayPlan = React.useMemo(
    () =>
      selectedIso
        ? selectPlanByRange(selectedIso, selectedIso).filter((p) => {
            const title = String(p.title || "").toLowerCase();
            const sType = String(p.session_type || "").toLowerCase();
            return !(sType === "rest" || title.startsWith("rest"));
          })
        : [],
    [selectedIso, selectPlanByRange]
  );

  return (
    <div className={["space-y-3", NO_X_OVERFLOW].join(" ")}>
      {/* HLAVIČKA + GRID */}
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

      {/* DETAIL (aktivity + plán) */}
      {selectedIso && (
        <div className="mt-3 ml-1 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-semibold">
              Aktivity &amp; plán — {dayLabel}
            </h3>
          </div>

          {/* reálne aktivity */}
          {dayActivities.length === 0 ? (
            <p className="text-sm opacity-70">
              Žiadne zaznamenané aktivity v zadanom období.
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm mb-3">
              {dayActivities.map((a: any) => {
                const sport =
                  a.sport || a.sport_type_fe || "other";
                const durMin = Math.round(
                  (Number(a.moving_time_s) || 0) / 60
                );
                const distKm =
                  (Number(a.distance_m) || 0) / 1000;
                return (
                  <li
                    key={a.activity_id}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor:
                            SPORT_COLORS[sport] ??
                            SPORT_COLORS.other,
                        }}
                      />
                      <span className="truncate">
                        {a.name || "(bez názvu)"}
                      </span>
                    </div>
                    <div className="text-xs opacity-70 flex-shrink-0">
                      {distKm > 0 && (
                        <span className="mr-2">
                          {distKm.toFixed(1)} km
                        </span>
                      )}
                      {durMin > 0 && <span>{durMin} min</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* plánované tréningy */}
          {dayPlan.length > 0 && (
            <div className="mt-3 border-t border-white/10 pt-3">
              <div className="text-xs uppercase tracking-wide opacity-70 mb-1.5">
                Plánované tréningy (AI)
              </div>
              <ul className="space-y-1.5 text-sm">
                {dayPlan.map((p) => {
                  const dur = p.duration_min ?? null;
                  const title = p.title || "(bez názvu)";
                  const sport = p.sport || "other";
                  const intensity = p.intensity || p.session_type || null;
                  const struct = (p.payload as any)?.structure;
                  const zoneText =
                    p.zone_text ||
                    (p.payload as any)?.target_hr_bpm_range?.length === 2
                      ? `HR ${
                          (p.payload as any)
                            ?.target_hr_bpm_range?.[0]
                        }–${
                          (p.payload as any)
                            ?.target_hr_bpm_range?.[1]
                        }`
                      : null;

                  return (
                    <li
                      key={p.id}
                      className="rounded-xl bg-black/20 border border-white/10 px-2.5 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor:
                                SPORT_COLORS[sport] ??
                                SPORT_COLORS.other,
                            }}
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium truncate">
                              {title}
                            </span>
                            <span className="text-[11px] opacity-70">
                              {sport}{" "}
                              {intensity ? `• ${intensity}` : ""}
                              {zoneText ? ` • ${zoneText}` : ""}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs opacity-80 flex-shrink-0">
                          {dur != null && `${dur} min`}
                        </div>
                      </div>

                      {struct && Array.isArray(struct) && struct.length > 0 && (
                        <details className="mt-1.5 text-xs">
                          <summary className="cursor-pointer opacity-80">
                            Zobraziť štruktúru
                          </summary>
                          <ul className="mt-1.5 space-y-0.5">
                            {struct.map((b: any, idx: number) => (
                              <li key={idx}>
                                {b.label ||
                                  b.part ||
                                  `Úsek ${idx + 1}`}{" "}
                                {b.duration_min
                                  ? `• ${b.duration_min} min`
                                  : ""}
                                {b.hr_zone
                                  ? ` • zóna ${b.hr_zone}`
                                  : ""}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {dayPlan.length === 0 && (
            <p className="mt-2 text-xs opacity-60">
              Pre tento deň nie je vytvorený žiadny plán.
            </p>
          )}
        </div>
      )}
    </div>
  );
}