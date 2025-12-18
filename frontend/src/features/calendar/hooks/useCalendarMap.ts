// src/features/calendar/hooks/useCalendarMap.ts
"use client";

import * as React from "react";
import type { ExternalEvent } from "@/features/coach/types/externalEvents";
import { detectSport } from "@/features/coach/utils/plan";

import type {
  CalendarMapState,
  DayCellData,
  SportKey,
  PlanStatus,
} from "@/features/calendar/types/calendarTypes";
import {
  daysInMonth,
  iso,
  startWeekday,
} from "@/features/calendar/utils/calendarDates";
import {
  isRestSession,
  planStatusForDate,
} from "@/features/calendar/utils/calendarFormat";
import {
  dedupeCalendarItems,
  eventDateIso,
  type CalendarItemBase,
  type CalendarItemKind,
} from "@/features/calendar/utils/calendarSlots";

type AnyObj = Record<string, any>;

type Args = {
  year: number;
  month0: number;

  actRows: any[];
  planRows: any[];
  externalRows: ExternalEvent[];

  safeSportKey: (v: any) => SportKey;
};

type DayShadowItem = CalendarItemBase & {
  source: "activity" | "plan" | "external";
  index: number;
};

export function useCalendarMap({
  year,
  month0,
  actRows,
  planRows,
  externalRows,
  safeSportKey,
}: Args): CalendarMapState {
  const [state, setState] = React.useState<CalendarMapState>({
    byIso: {},
    cells: [],
  });

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

    // externals (expandované cez occurrence_date / single_date atď.)
    for (const ev of externalRows) {
      const dIso = eventDateIso(ev);
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

      const sport = safeSportKey(
        (p as any).sport || detectSport(sess) || "other",
      );

      const actIdRaw = (p as any).activity_id;
      const actId =
        actIdRaw != null && !Number.isNaN(Number(actIdRaw))
          ? Number(actIdRaw)
          : null;

      const status: PlanStatus = planStatusForDate(dIso, todayIso, actId);

      const cell = byIso[dIso];
      if (!cell) continue;

      cell.plans.push({
        id: p.id,
        sport,
        status,
        // voliteľné – použijeme v dedupe (done vs activity)
        activityId: actId ?? undefined,
      } as any);
    }

    // activities
    for (const r of actRows) {
      const dIso = String(r.date).slice(0, 10);
      if (dIso < firstIso || dIso > lastIso) continue;

      const cell = byIso[dIso];
      if (!cell) continue;

      const aid = Number(r.activity_id);
      const sport = safeSportKey(
        (r as any).sport || (r as any).sport_type_fe || "other",
      );

      cell.activities.push({
        id: aid,
        sport,
        name: r.name || "",
      });
    }

    // DEDUPE v gride cez shared util:
    // - DONE vs ACTIVITY podľa activityId (žiadna bodka + fajka za ten istý workout)
    // - podľa športu: activity/done má prioritu pred plan/missed/external, plan/missed pred external
    for (const k of Object.keys(byIso)) {
      const cell = byIso[k];

      const shadows: DayShadowItem[] = [];

      // activities
      cell.activities.forEach((a, idx) => {
        shadows.push({
          sport: String(a.sport),
          kind: "activity",
          activityId: a.id,
          source: "activity",
          index: idx,
        });
      });

      // externals
      cell.externals.forEach((e, idx) => {
        shadows.push({
          sport: String(e.sport),
          kind: "external",
          activityId: null,
          source: "external",
          index: idx,
        });
      });

      // plans (planned / done / missed) – berieme aj activityId z plánu
      cell.plans.forEach((p: any, idx) => {
        const kind: CalendarItemKind =
          p.status === "planned"
            ? "plan"
            : p.status === "done"
            ? "done"
            : "missed";

        shadows.push({
          sport: String(p.sport),
          kind,
          activityId:
            p.activityId != null && !Number.isNaN(Number(p.activityId))
              ? Number(p.activityId)
              : null,
          source: "plan",
          index: idx,
        });
      });

      if (!shadows.length) continue;

      const deduped = dedupeCalendarItems<DayShadowItem>(shadows);
      if (deduped.length === shadows.length) continue;

      const keepActivityIdx = new Set<number>();
      const keepExternalIdx = new Set<number>();
      const keepPlanIdx = new Set<number>();

      for (const it of deduped) {
        if (it.source === "activity") keepActivityIdx.add(it.index);
        else if (it.source === "external") keepExternalIdx.add(it.index);
        else keepPlanIdx.add(it.index);
      }

      cell.activities = cell.activities.filter((_, idx) =>
        keepActivityIdx.has(idx),
      );
      cell.externals = cell.externals.filter((_, idx) =>
        keepExternalIdx.has(idx),
      );
      cell.plans = cell.plans.filter((_, idx) => keepPlanIdx.has(idx));
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