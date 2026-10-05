// src/app/features/coach/hooks/useExternalPlanRows.ts
"use client";

import * as React from "react";
import { apiGetExternalEventsWindow } from "@/app/features/coach/api/coach_external_events";

/**
 * Opakujúce sa externé aktivity (futbal v stredu) v tvare riadku plánu.
 *
 * PREČO NA FE: denný plán berie riadky z coach_plan_daily, kde externé
 * aktivity zámerne nie sú (zlučujú sa pri čítaní - viď CLAUDE.md). Window
 * endpoint ich vracia už spárované so Stravou a so štruktúrou udalosti,
 * takže stačí ich preložiť na rovnaký tvar ako BE _external_event_sessions.
 * Záporné id = nie je to riadok plánu (karta ich nedovolí upraviť ani presunúť).
 */
export function useExternalPlanRows(
  userId: number | null | undefined,
  fromIso: string,
  toIso: string,
): any[] {
  const [rows, setRows] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (!userId || !fromIso || !toIso) return;
    let alive = true;
    apiGetExternalEventsWindow(Number(userId), fromIso, toIso)
      .then((list) => {
        if (!alive) return;
        setRows(
          (list ?? []).map((ev: any, idx: number) => ({
            id: -(idx + 1),
            plan_date: String(ev.occurrence_date || ev.single_date || "").slice(0, 10),
            session_index: 90 + idx,
            sport: ev.sport || "other",
            title: ev.title,
            duration_min: ev.duration_min ?? null,
            intensity: null,
            notes: ev.notes ?? null,
            session_type: "external_event",
            structure: ev.structure ?? null,
            payload: null,
            status: ev.status || "planned",
            activity_id: ev.activity_id ?? null,
            is_external: true,
            start_time_local: ev.start_time_local ?? null,
          })),
        );
      })
      .catch(() => {
        if (alive) setRows([]);
      });
    return () => {
      alive = false;
    };
  }, [userId, fromIso, toIso]);

  return rows;
}
