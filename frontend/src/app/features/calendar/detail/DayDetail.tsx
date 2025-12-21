// src/features/calendar/detail/DayDetail.tsx
"use client";

import * as React from "react";
import type { ExternalEvent } from "@/features/coach/types/externalEvents";
import SessionCard from "@/app/shared/components/SessionCard";
import { buildDayBuckets } from "@/features/calendar/detail/buildDayBuckets";

type Props = {
  selectedIso: string;
  selectedLabel: string;

  actRows: any[];
  planRowsForDay: any[];
  externalRows: ExternalEvent[];

  safeSportKey: (v: any) => string;
  actMap?: Map<number, any>;
};

/**
 * Doplnenie planRaw / planStructure / planExercises pre všetky položky typu "plan".
 * Vďaka tomu má silový tréning v kalendári rovnaký detail (EXERCISES blok)
 * ako v AI daily pláne.
 */
function enrichPlansWithStructure(items: any[], planRowsForDay: any[]) {
  if (!items?.length || !planRowsForDay?.length) return items;

  const planById = new Map<any, any>();
  for (const p of planRowsForDay) {
    if (p && p.id != null) {
      planById.set(p.id, p);
    }
  }

  return items.map((it) => {
    if (!it || it.kind !== "plan") return it;

    const row = planById.get(it.id);
    if (!row) return it;

    const sess: any = row.payload ?? row;
    const structure = sess?.structure ?? null;

    const exercises = Array.isArray(sess?.strength_exercises)
      ? sess.strength_exercises
      : Array.isArray(structure?.strength_exercises)
      ? structure.strength_exercises
      : [];

    return {
      ...it,
      planRaw: sess,
      planStructure: structure,
      planExercises: exercises,
    };
  });
}

export default function DayDetail({
  selectedIso,
  selectedLabel,
  actRows,
  planRowsForDay,
  externalRows,
  safeSportKey,
}: Props) {
  const { past, planned } = React.useMemo(
    () =>
      buildDayBuckets({
        selectedIso,
        actRows,
        planRowsForDay,
        externalRows,
        safeSportKey,
      }),
    [selectedIso, actRows, planRowsForDay, externalRows, safeSportKey]
  );

  const pastEnriched = React.useMemo(
    () => enrichPlansWithStructure(past, planRowsForDay),
    [past, planRowsForDay]
  );

  const plannedEnriched = React.useMemo(
    () => enrichPlansWithStructure(planned, planRowsForDay),
    [planned, planRowsForDay]
  );

  return (
    <div className="mt-3 ml-1 space-y-3">
      {/* PAST */}
      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wide opacity-70">
          Past — {selectedLabel}
        </div>

        {pastEnriched.length === 0 ? (
          <div className="text-sm opacity-70">
            Žiadne položky v minulosti pre tento deň.
          </div>
        ) : (
          <ul className="space-y-2">
            {pastEnriched.map((it: any) => (
              <li key={it.id} className="px-0">
                <SessionCard variant="calendar" item={it} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* PLANNED */}
      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wide opacity-70">
          Planned — {selectedLabel}
        </div>

        {plannedEnriched.length === 0 ? (
          <div className="text-sm opacity-70">
            Žiadne plánované položky pre tento deň.
          </div>
        ) : (
          <ul className="space-y-2">
            {plannedEnriched.map((it: any) => (
              <li key={it.id} className="px-0">
                <SessionCard variant="calendar" item={it} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
