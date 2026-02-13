"use client";

import * as React from "react";
import { apiGetExternalEventsWindow } from "@/app/features/coach/api/coach_external_events";
import type { ExternalEvent } from "@/app/features/coach/types/externalEvents";
import type { CalendarExternalState, CalendarGridRange } from "@/app/features/calendar//types/calendarTypes";
import { useT } from "@/app/shared/i18n/useT";

export function useCalendarExternals(
  userId: number | null | undefined,
  range: CalendarGridRange
): CalendarExternalState {
  const t = useT();
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
        setErr(e?.message ?? t("calendar.failedLoadExternal"));
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId, range.fromIso, range.toIso]);

  return { rows, err };
}