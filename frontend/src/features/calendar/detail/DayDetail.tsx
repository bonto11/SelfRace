"use client";

import * as React from "react";
import type { ExternalEvent } from "@/features/coach/types/externalEvents";
import { detectSport } from "@/features/coach/utils/plan";

import CalendarItemCard from "@/features/calendar/detail/CalendarItemCard";
import type{ CalendarPlanStatus } from "@/features/calendar/types/calendarTypes";

import {
  normDuration,
  normIntensity,
  normNotes,
  normTarget,
  normTitle,
  fmtRealDurationMin,
  planStatusForDate,
} from "@/features/calendar/utils/calendarFormat";

type AnyObj = Record<string, any>;

type Props = {
  selectedIso: string;
  selectedLabel: string;

  actRows: any[];
  planRowsForDay: any[];
  externalRows: ExternalEvent[];

  safeSportKey: (v: any) => string;

  actMap: Map<number, any>;
};

function isValidId(x: any): x is number {
  const n = Number(x);
  return Number.isFinite(n) && n > 0;
}

function toTimeLabel(v: any): string | null {
  const s = String(v || "").trim();
  return s ? s : null;
}

export default function DayDetail({
  selectedIso,
  selectedLabel,
  actRows,
  planRowsForDay,
  externalRows,
  safeSportKey,
  actMap,
}: Props) {
  const todayIso = new Date().toISOString().slice(0, 10);

  // activities for day
  const activitiesForDay = React.useMemo(() => {
    return actRows.filter((r: any) => String(r.date).slice(0, 10) === selectedIso);
  }, [actRows, selectedIso]);

  // externals for day
  const externalsForDay = React.useMemo(() => {
    return externalRows.filter((ev: any) => {
      const dIso = String(ev.occurrence_date || ev.single_date || "").slice(0, 10).trim();
      return dIso === selectedIso;
    });
  }, [externalRows, selectedIso]);

  // link-based dedupe:
  // - plan has activity_id => hide plan, show activity
  // - external has activity_id/linked_activity_id => hide external, show activity
  const linkedActivityIds = React.useMemo(() => {
    const ids = new Set<number>();

    for (const p of planRowsForDay) {
      const a = (p as any).activity_id;
      if (isValidId(a)) ids.add(Number(a));
    }

    for (const ev of externalsForDay as any[]) {
      const a = ev.activity_id ?? ev.linked_activity_id ?? null;
      if (isValidId(a)) ids.add(Number(a));
    }

    return ids;
  }, [planRowsForDay, externalsForDay]);

  // helper: is activity present for id
  const activityIdSetForDay = React.useMemo(() => {
    const s = new Set<number>();
    for (const r of activitiesForDay) {
      const id = Number((r as any).activity_id);
      if (Number.isFinite(id)) s.add(id);
    }
    return s;
  }, [activitiesForDay]);

  // build items
  const pastItems = React.useMemo(() => {
    const items: Array<React.ReactNode> = [];

    // activities always go to Past (they exist only if done)
    for (const a of activitiesForDay) {
      const aid = Number((a as any).activity_id);
      const sport = safeSportKey((a as any).sport || (a as any).sport_type_fe || "other");
      const distKm =
        (a as any).distance_m != null ? Number((a as any).distance_m) / 1000 : null;
      const durMin =
        (a as any).moving_time_s != null
          ? Math.round(Number((a as any).moving_time_s) / 60)
          : (a as any).moving_time != null
          ? Math.round(Number((a as any).moving_time) / 60)
          : null;

      items.push(
        <CalendarItemCard
          key={`act-${aid}`}
          kind="activity"
          id={aid}
          dateIso={selectedIso}
          sport={sport}
          title={String((a as any).name || "Activity")}
          distanceKm={distKm}
          durationMin={durMin}
          notes={null}
          status={"done"}
        />
      );
    }

    // plans without activity_id that are in past => missed (or done handled above)
    for (const p of planRowsForDay) {
      const actId = (p as any).activity_id;
      if (isValidId(actId)) continue; // linked => hide plan

      const dIso = String((p as any).plan_date).slice(0, 10);
      if (dIso >= todayIso) continue; // future planned -> goes to Planned

      const sess: AnyObj = (p as any).payload ?? p;
      const sport = safeSportKey((p as any).sport || detectSport(sess) || "other");

      const status: CalendarPlanStatus = planStatusForDate(dIso, todayIso, null);
      // status will be "missed" here

      const kpis = [
        normDuration(sess) ? { label: "DURATION", value: normDuration(sess)! } : null,
        normIntensity(sess) ? { label: "INTENSITY", value: normIntensity(sess)! } : null,
        normTarget(sess) ? { label: "TARGET", value: normTarget(sess)! } : null,
      ].filter(Boolean) as Array<{ label: string; value: string }>;

      items.push(
        <CalendarItemCard
          key={`plan-missed-${p.id}`}
          kind="plan"
          id={p.id}
          dateIso={dIso}
          sport={sport}
          title={normTitle(sess) || "Tréning"}
          status={status}
          kpis={kpis}
          notes={normNotes(sess)}
          realSummary={null}
        />
      );
    }

    // externals in past (only if NOT linked to an activity)
    for (const ev of externalsForDay as any[]) {
      const linked = ev.activity_id ?? ev.linked_activity_id ?? null;
      if (isValidId(linked) && activityIdSetForDay.has(Number(linked))) continue;

      const sport = safeSportKey(ev.sport);
      const timeLabel = toTimeLabel(ev.start_time_local);

      if (selectedIso >= todayIso) continue; // future -> Planned
      items.push(
        <CalendarItemCard
          key={`ext-past-${ev.id}`}
          kind="external"
          id={ev.id ?? `ext-${Math.random()}`}
          dateIso={selectedIso}
          sport={sport}
          title={String(ev.title || "External")}
          timeLabel={timeLabel}
          notes={String(ev.notes || "") || null}
        />
      );
    }

    return items;
  }, [
    activitiesForDay,
    planRowsForDay,
    externalsForDay,
    safeSportKey,
    selectedIso,
    todayIso,
    activityIdSetForDay,
  ]);

  const plannedItems = React.useMemo(() => {
    const items: Array<React.ReactNode> = [];

    // plans without activity_id that are today/future => planned
    for (const p of planRowsForDay) {
      const actId = (p as any).activity_id;
      if (isValidId(actId)) continue; // linked => hide plan

      const dIso = String((p as any).plan_date).slice(0, 10);
      if (dIso < todayIso) continue;

      const sess: AnyObj = (p as any).payload ?? p;
      const sport = safeSportKey((p as any).sport || detectSport(sess) || "other");

      const status: CalendarPlanStatus = planStatusForDate(dIso, todayIso, null);

      const kpis = [
        normDuration(sess) ? { label: "DURATION", value: normDuration(sess)! } : null,
        normIntensity(sess) ? { label: "INTENSITY", value: normIntensity(sess)! } : null,
        normTarget(sess) ? { label: "TARGET", value: normTarget(sess)! } : null,
      ].filter(Boolean) as Array<{ label: string; value: string }>;

      items.push(
        <CalendarItemCard
          key={`plan-${p.id}`}
          kind="plan"
          id={p.id}
          dateIso={dIso}
          sport={sport}
          title={normTitle(sess) || "Tréning"}
          status={status}
          kpis={kpis}
          notes={normNotes(sess)}
          realSummary={null}
        />
      );
    }

    // externals today/future (only if NOT linked to an activity)
    for (const ev of externalsForDay as any[]) {
      const linked = ev.activity_id ?? ev.linked_activity_id ?? null;
      if (isValidId(linked) && activityIdSetForDay.has(Number(linked))) continue;

      const sport = safeSportKey(ev.sport);
      const timeLabel = toTimeLabel(ev.start_time_local);

      if (selectedIso < todayIso) continue;
      items.push(
        <CalendarItemCard
          key={`ext-planned-${ev.id}`}
          kind="external"
          id={ev.id ?? `ext-${Math.random()}`}
          dateIso={selectedIso}
          sport={sport}
          title={String(ev.title || "External")}
          timeLabel={timeLabel}
          notes={String(ev.notes || "") || null}
        />
      );
    }

    return items;
  }, [
    planRowsForDay,
    externalsForDay,
    safeSportKey,
    selectedIso,
    todayIso,
    activityIdSetForDay,
  ]);

  return (
    <div className="mt-3 ml-1 space-y-3">
      {/* Past */}
      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wide opacity-70">
          Past — {selectedLabel}
        </div>

        {pastItems.length === 0 ? (
          <div className="text-sm opacity-70">Žiadne položky v minulosti pre tento deň.</div>
        ) : (
          <div className="space-y-2">{pastItems}</div>
        )}
      </div>

      {/* Planned */}
      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wide opacity-70">
          Planned — {selectedLabel}
        </div>

        {plannedItems.length === 0 ? (
          <div className="text-sm opacity-70">Žiadne plánované položky pre tento deň.</div>
        ) : (
          <div className="space-y-2">{plannedItems}</div>
        )}
      </div>
    </div>
  );
}