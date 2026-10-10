// src/features/calendar/hooks/useCalendarMap.ts
"use client";

import * as React from "react";
import type { ExternalEvent } from "@/app/features/coach/types/externalEvents";
import { detectSport } from "@/app/shared/utils/sportMeta";

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
import { loggedPlanIds, type LoggedStrength } from "@/app/features/calendar/utils/loggedStrength";
import { useT } from "@/app/shared/i18n/useT";
import { todayIsoLocal } from "@/app/shared/ui/components/StatusMark";

type AnyObj = Record<string, any>;

type Args = {
  year: number;
  month0: number;

  actRows: any[];
  planRows: any[];
  externalRows: ExternalEvent[];
  /** odcvičené ručné zápisy silového tréningu (bez Stravy) */
  strengthRows?: LoggedStrength[];

  safeSportKey: (v: any) => SportKey;
};

const NO_STRENGTH: LoggedStrength[] = [];

// 🌟 Rozšírený Shadow Item aby pobral aj 'postponed'
type DayShadowItem = CalendarItemBase & {
  source: "activity" | "plan" | "external";
  index: number;
  kind: CalendarItemKind | "postponed" | "done" | "missed";
};

export function useCalendarMap({
  year,
  month0,
  actRows,
  planRows,
  externalRows,
  strengthRows = NO_STRENGTH,
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
    // lokálny dátum – toISOString by po polnoci posunul deň (UTC)
    const todayIso = todayIsoLocal();

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

    if (process.env.NODE_ENV !== "production") {
      console.log(
        "[useCalendarMap][debug] activityIdsByDate",
        Object.fromEntries(
          Array.from(activityIdsByDate.entries()).map(([k, v]) => [k, Array.from(v)]),
        ),
      );
      console.log(
        "[useCalendarMap][debug] planRows raw sample",
        (planRows as any[]).slice(0, 20).map((p) => ({
          id: p.id,
          plan_date: p.plan_date,
          status: p.status,
          activity_id: p.activity_id,
        })),
      );
    }

    // externals - id výskytu = id definície + dátum (weekly sa opakuje)
    const matchedExternalActIds = new Set<number>();
    externalRows.forEach((ev, idx) => {
      const dIso = eventDateIso(ev);
      if (!dIso) return;
      if (dIso < firstIso || dIso > lastIso) return;

      const cell = byIso[dIso];
      if (!cell) return;

      const actId =
        ev.activity_id != null && !Number.isNaN(Number(ev.activity_id))
          ? Number(ev.activity_id)
          : null;
      if (actId != null) matchedExternalActIds.add(actId);

      cell.externals.push({
        id: -(idx + 1),
        sport: safeSportKey((ev as any).sport ?? (ev as any).sport_type),
        title: String(ev.title || t("calendar.external")),
        time: (ev as any).start_time_local ?? null,
        notes: (ev as any).notes ?? null,
        activityId: actId,
      });
    });

    // plán so zápisom silového tréningu je splnený aj bez Stravy
    const planDoneByLog = loggedPlanIds(strengthRows);
    const planIdsInGrid = new Set<number>();

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
        actIdForPlan = Number(rawActId);
      }

      // BE status "done" je autoritatívny signál (nastavuje sa pri PATCH match/unmatch).
      // Predtým sa "done" prepočítavalo len ak activity_id sedelo s activityIdsByDate
      // pre daný mesiac - čo zlyhávalo, keď aktivita nebola v aktuálne načítanom
      // rozsahu actRows (napr. pri prepínaní mesiacov). Teraz: ak BE povie "done",
      // je to done, bodka.
      if (dbStatus !== "done" && actIdForPlan != null) {
        const set = activityIdsByDate.get(dIso);
        if (set && set.has(actIdForPlan)) {
          dbStatus = "done";
        }
      }

      if (dbStatus !== "done" && dbStatus !== "postponed" && planDoneByLog.has(Number(p.id))) {
        dbStatus = "done";
      }
      planIdsInGrid.add(Number(p.id));

      // 🌟 AK TO NIE JE DONE/postponed A JE TO V MINULOSTI -> JE TO MISSED
      if (dbStatus === "planned" && dIso < todayIso) {
        dbStatus = "missed";
      }

      if (process.env.NODE_ENV !== "production") {
        console.log("[useCalendarMap][plan-debug]", {
          planId: p.id,
          dIso,
          rawStatusFromDB: p.status,
          rawActId,
          resolvedActIdForPlan: actIdForPlan,
          activitiesFoundForDate: activityIdsByDate.get(dIso)
            ? Array.from(activityIdsByDate.get(dIso)!)
            : [],
          finalDbStatus: dbStatus,
        });
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
      // aktivita, ktorá splnila externú aktivitu, sa ukáže ako jej ✓
      if (matchedExternalActIds.has(aid)) continue;
      const sport = safeSportKey(
        (r as any).sport || (r as any).sport_type_fe || (r as any).sport_type,
      );

      cell.activities.push({
        id: aid,
        sport,
        name: (r as any).name || "",
      });
    }

    // voľné zápisy silového tréningu = aktivita (záporné id, aby sa nebili so Stravou)
    for (const l of strengthRows) {
      if (l.planSessionId != null && planIdsInGrid.has(Number(l.planSessionId))) continue;
      const cell = byIso[l.date];
      if (!cell || l.date < firstIso || l.date > lastIso) continue;
      cell.activities.push({ id: -l.id, sport: "strength", name: l.title || "" } as any);
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

      // Externé aktivity do dedupe nejdú - zobrazia sa vždy, aj keď je v
      // ten deň plán alebo aktivita rovnakého športu (klubový beh večer
      // a vlastný beh ráno sú dve veci). Spárovanú aktivitu už skryli vyššie.

      cell.plans.forEach((p: any, idx) => {
        // 🌟 Presné mapovanie statusu z DB na kind pre vizuál v kalendári
        let kind: DayShadowItem["kind"] = "plan";
        
        if (p.status === "done") kind = "done";
        else if (p.status === "missed") kind = "missed";
        else if (p.status === "postponed") kind = "postponed";

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

      if (process.env.NODE_ENV !== "production" && deduped.length !== shadows.length) {
        console.log("[useCalendarMap][dedupe-debug]", {
          dIso: k,
          before: shadows.map((s) => ({ kind: s.kind, sport: s.sport, activityId: s.activityId })),
          after: deduped.map((s) => ({ kind: s.kind, sport: s.sport, activityId: s.activityId })),
        });
      }

      if (deduped.length === shadows.length) continue;

      const keepActivityIdx = new Set<number>();
      const keepPlanIdx = new Set<number>();

      for (const it of deduped) {
        if (it.source === "activity") keepActivityIdx.add(it.index);
        else if (it.source === "plan") keepPlanIdx.add(it.index);
      }

      cell.activities = cell.activities.filter((_, idx) =>
        keepActivityIdx.has(idx),
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
  }, [year, month0, actRows, planRows, externalRows, strengthRows, safeSportKey, t]);

  return state;
}