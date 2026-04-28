// src/features/calendar/hooks/useCalendarMap.ts
"use client";

import * as React from "react";
import type { ExternalEvent } from "@/app/features/coach/types/externalEvents";
import { detectSport } from "@/app/shared/utils/sports";

import type {
  CalendarMapState,
  DayCellData,
  SportKey,
  PlanStatus,
} from "@/app/features/calendar/types/calendarTypes";
import {
  daysInMonth,
  iso,
  startWeekday,
} from "@/app/features/calendar/utils/calendarDates";
import {
  isRestSession,
} from "@/app/features/calendar/utils/calendarFormat";
import {
  dedupeCalendarItems,
  eventDateIso,
  type CalendarItemBase,
  type CalendarItemKind,
} from "@/app/features/calendar/utils/calendarSlots";
import { useT } from "@/app/shared/i18n/useT";

type AnyObj = Record<string, any>;

type Args = {
  year: number;
  month0: number;

  actRows: any[];
  planRows: any[];
  externalRows: ExternalEvent[];

  safeSportKey: (v: any) => SportKey;
};

// 🌟 Rozšírený Shadow Item aby pobral aj 'skipped'
type DayShadowItem = CalendarItemBase & {
  source: "activity" | "plan" | "external";
  index: number;
  kind: CalendarItemKind | "skipped" | "done" | "missed";
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
  const t = useT();

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

    // --- precompute activityIdsByDate ---
    const activityIdsByDate = new Map<string, Set<number>>();
    for (const r of actRows as any[]) {
      const dIso = String(r.date ?? "").slice(0, 10);
      if (!dIso || dIso < firstIso || dIso > lastIso) continue;

      const aid = Number((r as any).activity_id);
      if (Number.isNaN(aid)) continue;

      let set = activityIdsByDate.get(dIso);
      if (!set) {
        set = new Set<number>();
        activityIdsByDate.set(dIso, set);
      }
      set.add(aid);
    }

    // externals
    for (const ev of externalRows) {
      const dIso = eventDateIso(ev);
      if (!dIso) continue;
      if (dIso < firstIso || dIso > lastIso) continue;

      const cell = byIso[dIso];
      if (!cell) continue;

      cell.externals.push({
        id: Number(ev.id ?? 0) || Math.floor(Math.random() * 1e9),
        sport: safeSportKey((ev as any).sport ?? (ev as any).sport_type),
        title: String(ev.title || t("calendar.external")),
        time: (ev as any).start_time_local ?? null,
        notes: (ev as any).notes ?? null,
      });
    }

    // plan rows
    for (const p of planRows as any[]) {
      const dIso = String(p.plan_date ?? "").slice(0, 10);
      if (!dIso || dIso < firstIso || dIso > lastIso) continue;

      const sess: AnyObj = p.payload ?? p;
      if (isRestSession(p, sess)) continue;

      const sport = safeSportKey(p.sport || detectSport(sess) || "other");

      const rawActId = (p as any).activity_id;
      let actIdForPlan: number | null = null;
      let dbStatus = p.status || "planned";

      if (rawActId != null && !Number.isNaN(Number(rawActId))) {
        const num = Number(rawActId);
        actIdForPlan = num;

        // Validation against real activities in the month
        const set = activityIdsByDate.get(dIso);
        if (set && set.has(num)) {
          dbStatus = "done"; 
        }
      }

      // 🌟 AK TO NIE JE DONE/SKIPPED A JE TO V MINULOSTI -> JE TO MISSED
      if (dbStatus === "planned" && dIso < todayIso) {
        dbStatus = "missed";
      }

      const cell = byIso[dIso];
      if (!cell) continue;

      cell.plans.push({
        id: p.id,
        sport,
        status: dbStatus as PlanStatus,
        activityId: actIdForPlan ?? undefined,
      } as any);
    }

    // activities
    for (const r of actRows as any[]) {
      const dIso = String(r.date ?? "").slice(0, 10);
      if (!dIso || dIso < firstIso || dIso > lastIso) continue;

      const cell = byIso[dIso];
      if (!cell) continue;

      const aid = Number((r as any).activity_id);
      const sport = safeSportKey(
        (r as any).sport || (r as any).sport_type_fe || (r as any).sport_type,
      );

      cell.activities.push({
        id: aid,
        sport,
        name: (r as any).name || "",
      });
    }

    // DEDUPE v gride cez shared util
    for (const k of Object.keys(byIso)) {
      const cell = byIso[k];
      const shadows: DayShadowItem[] = [];

      cell.activities.forEach((a, idx) => {
        shadows.push({
          sport: String(a.sport),
          kind: "activity",
          activityId: a.id,
          source: "activity",
          index: idx,
        });
      });

      cell.externals.forEach((e, idx) => {
        shadows.push({
          sport: String(e.sport),
          kind: "external",
          activityId: null,
          source: "external",
          index: idx,
        });
      });

      cell.plans.forEach((p: any, idx) => {
        // 🌟 Presné mapovanie statusu z DB na kind pre vizuál v kalendári
        let kind: DayShadowItem["kind"] = "plan";
        
        if (p.status === "done") kind = "done";
        else if (p.status === "missed") kind = "missed";
        else if (p.status === "skipped") kind = "skipped";

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

    const cells: DayCellData[] = [];
    for (let i = 0; i < totalCells; i++) {
      const d = new Date(firstCell);
      d.setDate(firstCell.getDate() + i);
      const k = iso(d.getFullYear(), d.getMonth(), d.getDate());
      cells.push(byIso[k]);
    }

    setState({ byIso, cells });
  }, [year, month0, actRows, planRows, externalRows, safeSportKey, t]);

  return state;
}