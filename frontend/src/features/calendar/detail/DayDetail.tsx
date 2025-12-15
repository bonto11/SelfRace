"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { CARD } from "@/shared/ui/classes";
import type { ExternalEvent } from "@/features/coach/types/externalEvents";

import ExternalEventsPanel from "@/features/calendar/detail/ExternalEventsPanel";
import DoneSessionsPanel from "@/features/calendar/detail/DoneSessionsPanel";
import PlannedSessionsPanel from "@/features/calendar/detail/PlannedSessionsPanel";
import { detectSport } from "@/features/coach/utils/plan";

const ActivityTable = dynamic(() => import("@/shared/components/ActivityTable"), { ssr: false });

type AnyObj = Record<string, any>;

type Props = {
  selectedIso: string;
  selectedLabel: string;

  // raw rows
  actRows: any[];
  planRowsForDay: any[];
  externalRows: ExternalEvent[];

  // dedupe helpers
  safeSportKey: (v: any) => string;
  sportColors: Record<string, string>;

  // focus
  focusedActivityId: number | null;
  setFocusedActivityId: (id: number | null) => void;

  // actMap for done summary
  actMap: Map<number, any>;
};

export default function DayDetail({
  selectedIso,
  selectedLabel,
  actRows,
  planRowsForDay,
  externalRows,
  safeSportKey,
  sportColors,
  focusedActivityId,
  setFocusedActivityId,
  actMap,
}: Props) {
  const todayIso = new Date().toISOString().slice(0, 10);

  // activity sports for day (dedupe externals/plans)
  const activitySports = React.useMemo(() => {
    const s = new Set<string>();
    for (const r of actRows) {
      const dIso = String(r.date).slice(0, 10);
      if (dIso !== selectedIso) continue;
      s.add(safeSportKey((r as any).sport || (r as any).sport_type_fe || "other"));
    }
    return s;
  }, [actRows, selectedIso, safeSportKey]);

  const externalsForDay = React.useMemo(() => {
    return externalRows
      .filter((ev) => {
        const dIso = String((ev as any).occurrence_date || ev.single_date || "").slice(0, 10).trim();
        if (dIso !== selectedIso) return false;
        const sport = safeSportKey(ev.sport);
        return !activitySports.has(sport);
      })
      .sort((a, b) => String((a as any).start_time_local || "").localeCompare(String((b as any).start_time_local || "")))
      .map((ev, idx) => ({
        id: (ev.id ?? idx) as any,
        sport: safeSportKey(ev.sport),
        title: String(ev.title || "External"),
        time: (ev as any).start_time_local ? String((ev as any).start_time_local) : null,
        notes: (ev as any).notes ? String((ev as any).notes) : null,
      }));
  }, [externalRows, selectedIso, activitySports, safeSportKey]);

  const donePlans = React.useMemo(
    () =>
      planRowsForDay.filter(
        (p: any) => p.activity_id != null && !Number.isNaN(Number(p.activity_id))
      ),
    [planRowsForDay]
  );

  const plannedRowsRaw = React.useMemo(
    () =>
      planRowsForDay.filter(
        (p: any) => p.activity_id == null || Number.isNaN(Number(p.activity_id))
      ),
    [planRowsForDay]
  );

  // dedupe planned rows: hide if activity of same sport exists
  const plannedRowsDeduped = React.useMemo(() => {
    return plannedRowsRaw.filter((p: any) => {
      const sess: AnyObj = p.payload ?? p;
      const sport = safeSportKey((p as any).sport || detectSport(sess) || "other");
      return !activitySports.has(sport);
    });
  }, [plannedRowsRaw, activitySports, safeSportKey]);

  return (
    <div className="mt-3 ml-1 space-y-3">
      <ExternalEventsPanel
        selectedIso={selectedIso}
        selectedLabel={selectedLabel}
        rows={externalsForDay}
        sportColors={sportColors}
      />

      <ActivityTable
        start={selectedIso}
        end={selectedIso}
        variant="calendar"
        suppressItemHeaderIfSingleDay
        autoOpenActivityId={focusedActivityId ?? undefined}
      />

      <div className={[CARD, "space-y-2", "p-3 md:p-4"].join(" ")}>
        <div className="flex items-center justify-between mb-1.5">
          <h3 className="text-sm font-semibold">Plán & stav tréningov — {selectedLabel}</h3>
        </div>

        {planRowsForDay.length === 0 && (
          <p className="text-sm opacity-70">Pre tento deň nie je vytvorený žiadny plán.</p>
        )}

        <DoneSessionsPanel
          selectedLabel={selectedLabel}
          donePlans={donePlans}
          actMap={actMap}
          onOpenActivity={(id) => setFocusedActivityId(id)}
        />

        <PlannedSessionsPanel todayIso={todayIso} plannedRows={plannedRowsDeduped} />
      </div>
    </div>
  );
}