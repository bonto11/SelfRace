"use client";

import * as React from "react";
import type { ExternalEvent } from "@/features/coach/types/externalEvents";
import { detectSport } from "@/features/coach/utils/plan";

import DayBucket from "./DayBucket";

type AnyObj = Record<string, any>;

export type UnifiedItem = {
  id: string;
  kind: "activity" | "plan" | "external";
  sport: string;
  dateIso: string;
  title: string;
  status?: "done" | "planned" | "missed";
  meta?: {
    distanceKm?: number;
    durationMin?: number;
    notes?: string;
  };
};

type Props = {
  selectedIso: string;

  actRows: any[];
  planRowsForDay: any[];
  externalRows: ExternalEvent[];

  safeSportKey: (v: any) => string;
};

export default function DayDetail({
  selectedIso,
  actRows,
  planRowsForDay,
  externalRows,
  safeSportKey,
}: Props) {
  const todayIso = new Date().toISOString().slice(0, 10);

  /* ---------------- build unified items ---------------- */

  const items = React.useMemo<UnifiedItem[]>(() => {
    const out: UnifiedItem[] = [];

    /* ACTIVITIES (highest priority) */
    const activityBySport = new Set<string>();

    for (const a of actRows) {
      const dIso = String(a.date).slice(0, 10);
      if (dIso !== selectedIso) continue;

      const sport = safeSportKey(a.sport || a.sport_type_fe || "other");
      activityBySport.add(sport);

      out.push({
        id: `act-${a.activity_id}`,
        kind: "activity",
        sport,
        dateIso: dIso,
        title: a.name || "Activity",
        status: "done",
        meta: {
          distanceKm: a.distance_m ? a.distance_m / 1000 : undefined,
          durationMin: a.moving_time_s
            ? Math.round(a.moving_time_s / 60)
            : undefined,
        },
      });
    }

    /* PLANS (only if no activity of same sport) */
    for (const p of planRowsForDay) {
      if (p.activity_id != null) continue; // linked → activity already rendered

      const sess: AnyObj = p.payload ?? p;
      const sport = safeSportKey(p.sport || detectSport(sess) || "other");

      if (activityBySport.has(sport)) continue;

      const dIso = String(p.plan_date).slice(0, 10);

      out.push({
        id: `plan-${p.id}`,
        kind: "plan",
        sport,
        dateIso: dIso,
        title: sess.title || sess.session_type || "Planned session",
        status: dIso < todayIso ? "missed" : "planned",
        meta: {
          notes: sess.notes ?? null,
        },
      });
    }

    /* EXTERNAL EVENTS (only if no activity of same sport) */
    for (const ev of externalRows) {
      const dIso = String(
        (ev as any).occurrence_date || ev.single_date || ""
      ).slice(0, 10);

      if (dIso !== selectedIso) continue;

      const sport = safeSportKey(ev.sport);
      if (activityBySport.has(sport)) continue;

      out.push({
        id: `ext-${ev.id}`,
        kind: "external",
        sport,
        dateIso: dIso,
        title: ev.title || "External event",
        status: dIso < todayIso ? "missed" : "planned",
        meta: {
          notes: (ev as any).notes ?? null,
        },
      });
    }

    return out;
  }, [actRows, planRowsForDay, externalRows, selectedIso, safeSportKey, todayIso]);

  /* ---------------- split past / planned ---------------- */

  const past = items.filter(
    (i) => i.kind === "activity" || i.dateIso < todayIso
  );

  const planned = items.filter(
    (i) => i.kind !== "activity" && i.dateIso >= todayIso
  );

  return (
    <div className="space-y-3">
      <DayBucket label="Past" items={past} />
      <DayBucket label="Planned" items={planned} />
    </div>
  );
}