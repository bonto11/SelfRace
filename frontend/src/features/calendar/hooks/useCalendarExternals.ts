"use client";

import * as React from "react";
import { apiGetExternalEventsWindow } from "@/features/coach/api/coach_external_events";
import type { ExternalEvent } from "@/features/coach/types/externalEvents";
import type { CalendarExternalState, CalendarGridRange } from "@/features/calendar//types/calendarTypes";

export function useCalendarExternals(
  userId: number | null | undefined,
  range: CalendarGridRange
): CalendarExternalState {
  const [rows, setRows] = React.useState<ExternalEvent[]>([]);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!userId) return;
    let alive = true;

    (async () => {
      setErr(null);
      try {
        const r = await apiGetExternalEventsWindow(userId, range.fromIso, range.toIso);
        if (!alive) return;
        setRows(Array.isArray(r) ? r : []);
      } catch (e: any) {
        if (!alive) return;
        setRows([]);
        setErr(e?.message ?? "Failed to load external events.");
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId, range.fromIso, range.toIso]);

  return { rows, err };
}