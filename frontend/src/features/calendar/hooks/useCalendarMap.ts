"use client";

import * as React from "react";
import type { ExternalEvent } from "@/features/coach/types/externalEvents";
import type { PlanStatus } from "@/shared/components/PlanSingle";
import { detectSport } from "@/features/coach/utils/plan";

import type { CalendarMapState, DayCellData, SportKey } from "@/features/calendar/types/calendarTypes";
import { daysInMonth, iso, startWeekday } from "@/features/calendar/utils/calendarDates";
import { isRestSession, planStatusForDate } from "@/features/calendar/utils/calendarFormat";

type AnyObj = Record<string, any>;

type Args = {
  year: number;
  month0: number;

  actRows: any[];
  planRows: any[];
  externalRows: ExternalEvent[];

  safeSportKey: (v: any) => SportKey;
};

export function useCalendarMap({
  year,
  month0,
  actRows,
  planRows,
  externalRows,
  safeSportKey,
}: Args): CalendarMapState {
  const [state, setState] = React.useState<CalendarMapState>({ byIso: {}, cells: [] });

  React.useEffect(() => {
    const totalCells = 42;
    const offset = startWeekday(year, month0);
    const firstCell = new Date(year, month0, 1 - offset);

    // init grid map
    const byIso: Record<string, DayCellData> = {};
    for (let i = 0; i < totalCells; i++) {
      const d = new Date(firstCell);
      d.setDate(firstCell.getDate() + i);

      const k = iso(d.getFullYear(), d.getMonth(), d.getDate());
      const inMonth = d.getMonth() === month0;

      byIso[k] = {
        iso: k,
        inMonth,
        day: inMonth ? d.getDate() : null,
        activities: [],
        plans: [],
        externals: [],
      };
    }

    const firstIso = iso(year, month0, 1);
    const lastIso = iso(year, month0, daysInMonth(year, month0));
    const todayIso = new Date().toISOString().slice(0, 10);

    // externals (expandované cez occurrence_date)
    for (const ev of externalRows) {
      const dIso = String((ev as any).occurrence_date || ev.single_date || "").slice(0, 10).trim();
      if (!dIso) continue;
      if (dIso < firstIso || dIso > lastIso) continue;

      const cell = byIso[dIso];
      if (!cell) continue;

      cell.externals.push({
        id: Number(ev.id ?? 0) || Math.floor(Math.random() * 1e9),
        sport: safeSportKey(ev.sport),
        title: String(ev.title || "External"),
        time: (ev as any).start_time_local ?? null,
        notes: (ev as any).notes ?? null,
      });
    }

    // plan rows
    for (const p of planRows) {
      const dIso = String(p.plan_date).slice(0, 10);
      if (dIso < firstIso || dIso > lastIso) continue;

      const sess: AnyObj = (p as any).payload ?? p;
      if (isRestSession(p, sess)) continue;

      const sport = safeSportKey((p as any).sport || detectSport(sess) || "other");

      const actIdRaw = (p as any).activity_id;
      const actId =
        actIdRaw != null && !Number.isNaN(Number(actIdRaw)) ? Number(actIdRaw) : null;

      const status: PlanStatus = planStatusForDate(dIso, todayIso, actId);

      const cell = byIso[dIso];
      if (!cell) continue;
      cell.plans.push({ id: p.id, sport, status });
    }

    // activities
    for (const r of actRows) {
      const dIso = String(r.date).slice(0, 10);
      if (dIso < firstIso || dIso > lastIso) continue;

      const cell = byIso[dIso];
      if (!cell) continue;

      const aid = Number(r.activity_id);
      const sport = safeSportKey((r as any).sport || (r as any).sport_type_fe || "other");

      cell.activities.push({
        id: aid,
        sport,
        name: r.name || "",
      });
    }

    // DEDUPE v gride:
    // ak existuje activity pre šport S → schovaj externals S + schovaj plan/missed S (done nechaj)
    for (const k of Object.keys(byIso)) {
      const cell = byIso[k];
      const actSports = new Set(cell.activities.map((a) => String(a.sport)));

      if (actSports.size > 0) {
        cell.externals = cell.externals.filter((e) => !actSports.has(String(e.sport)));
        cell.plans = cell.plans.filter((p) => {
          if (p.status === "done") return true;
          return !actSports.has(String(p.sport));
        });
      }
    }

    // cells array
    const cells: DayCellData[] = [];
    for (let i = 0; i < totalCells; i++) {
      const d = new Date(firstCell);
      d.setDate(firstCell.getDate() + i);
      const k = iso(d.getFullYear(), d.getMonth(), d.getDate());
      cells.push(byIso[k]);
    }

    setState({ byIso, cells });
  }, [year, month0, actRows, planRows, externalRows, safeSportKey]);

  return state;
}