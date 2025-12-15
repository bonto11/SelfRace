// src/features/calendar/detail/DayDetail.tsx
"use client";

import * as React from "react";
import type { ExternalEvent } from "@/features/coach/types/externalEvents";
import SessionCard from "@/shared/components/SessionCard";
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

  return (
    <div className="mt-3 ml-1 space-y-3">
      {/* PAST */}
      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wide opacity-70">
          Past — {selectedLabel}
        </div>

        {past.length === 0 ? (
          <div className="text-sm opacity-70">Žiadne položky v minulosti pre tento deň.</div>
        ) : (
          <ul className="space-y-2">
            {past.map((it: any) => (
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

        {planned.length === 0 ? (
          <div className="text-sm opacity-70">Žiadne plánované položky pre tento deň.</div>
        ) : (
          <ul className="space-y-2">
            {planned.map((it: any) => (
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