"use client";

/*
 * Značky po dňoch (plán, externé aktivity, aktivity zo Stravy) pre krátke
 * okno – denný widget a malý kalendár. Rovnaké pravidlá ako veľký kalendár
 * (useCalendarMap): stav plánu cez planMarkKind, dedupe cez dedupeCalendarItems.
 */

import * as React from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";
import { useExternalPlanRows } from "@/app/features/coach/hooks/useExternalPlanRows";
import { dedupeCalendarItems, type CalendarItemKind } from "@/app/features/calendar/utils/calendarSlots";
import { planMarkKind, todayIsoLocal, type MarkKind } from "@/app/shared/ui/components/StatusMark";

export type DayMark = {
  key: string;
  sport: string;
  kind: MarkKind;
  activityId: number | null;
};

const numOrNull = (v: unknown): number | null =>
  v != null && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : null;

/** MarkKind → kind pre dedupe (postponed sa nededupuje, ide ako „plan“ iného druhu) */
type DedupeItem = DayMark & { kind: CalendarItemKind };

export function useDayMarks(startIso: string, endIso: string): Map<string, DayMark[]> {
  const { userId } = useUserId();
  const { selectByRange } = useActivityData();
  const {
    plan: { selectPlanByRange },
  } = useCoachData();
  const externalRows = useExternalPlanRows(userId, startIso, endIso);

  return React.useMemo(() => {
    const map = new Map<string, DayMark[]>();
    const start = new Date(`${startIso}T00:00:00`);
    const end = new Date(`${endIso}T00:00:00`);
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      map.set(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
        [],
      );
    }
    const today = todayIsoLocal();
    const matched = new Set<number>();

    for (const p of selectPlanByRange(startIso, endIso) as any[]) {
      const k = String(p.plan_date ?? "").slice(0, 10);
      if (!map.has(k)) continue;
      // voľno = bez dĺžky (rovnaké pravidlo ako isRestSession)
      if (p.duration_min == null || Number(p.duration_min) === 0) continue;
      const activityId = numOrNull(p.activity_id);
      if (activityId != null) matched.add(activityId);
      map.get(k)!.push({
        key: `p-${p.id}`,
        sport: String(p.sport || "other").toLowerCase(),
        kind: planMarkKind({ status: p.status, dateIso: k, activityId, todayIso: today }),
        activityId,
      });
    }

    const externals: { k: string; mark: DayMark }[] = [];
    for (const ev of externalRows) {
      const k = String(ev.plan_date ?? "").slice(0, 10);
      if (!map.has(k)) continue;
      const activityId = numOrNull(ev.activity_id);
      if (activityId != null) matched.add(activityId);
      externals.push({
        k,
        mark: {
          key: `e-${ev.id}`,
          sport: String(ev.sport || "other").toLowerCase(),
          kind: planMarkKind({ status: ev.status, dateIso: k, activityId, external: true, todayIso: today }),
          activityId,
        },
      });
    }

    for (const r of selectByRange(startIso, endIso) as any[]) {
      const k = String(r.date ?? "").slice(0, 10);
      if (!map.has(k)) continue;
      const activityId = numOrNull(r.activity_id);
      // aktivita spárovaná s plánom alebo externou aktivitou je už ako ✓
      if (activityId != null && matched.has(activityId)) continue;
      map.get(k)!.push({
        key: `a-${activityId ?? k}`,
        sport: String(r.sport ?? r.sport_type_fe ?? r.sport_type ?? "other").toLowerCase(),
        kind: "activity",
        activityId,
      });
    }

    for (const [k, arr] of map.entries()) {
      // odložené nejdú do dedupe – nemajú sa skryť kvôli aktivite rovnakého športu
      const postponed = arr.filter((m) => m.kind === "postponed");
      const rest = dedupeCalendarItems<DedupeItem>(arr.filter((m) => m.kind !== "postponed") as DedupeItem[]);
      map.set(k, [...rest, ...postponed]);
    }
    // externé až po dedupe – klubový futbal sa nemá skryť kvôli vlastnému behu
    for (const { k, mark } of externals) map.get(k)!.push(mark);

    return map;
  }, [startIso, endIso, selectPlanByRange, selectByRange, externalRows]);
}
