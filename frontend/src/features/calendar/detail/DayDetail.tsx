"use client";

import * as React from "react";
import { CARD } from "@/shared/ui/classes";
import type { ExternalEvent } from "@/features/coach/types/externalEvents";
import { detectSport } from "@/features/coach/utils/plan";
import type { PlanStatus } from "@/shared/components/PlanSingle";

import PastSessionsPanel, {
  type UnifiedSessionItem,
} from "@/features/calendar/detail/PastSessionsPanel";
import PlannedSessionsPanel from "@/features/calendar/detail/PlannedSessionsPanel";

type AnyObj = Record<string, any>;

type Props = {
  selectedIso: string;
  selectedLabel: string;

  // raw rows
  actRows: any[];
  planRowsForDay: any[];
  externalRows: ExternalEvent[];

  // helpers
  safeSportKey: (v: any) => string;
  sportColors: Record<string, string>;

  // focus (nechávam do budúcna – dnes len nastavíme)
  focusedActivityId: number | null;
  setFocusedActivityId: (id: number | null) => void;

  // actMap for done summary / fallback
  actMap: Map<number, any>;
};

function toIsoDay(v: any): string {
  return String(v || "").slice(0, 10);
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function sortTime(a?: string | null, b?: string | null): number {
  return String(a || "").localeCompare(String(b || ""));
}

function planStatusForDate(dIso: string, todayIso: string, actId: number | null): PlanStatus {
  if (actId != null && Number.isFinite(actId)) return "done";
  return dIso < todayIso ? "missed" : "planned";
}

// ---- Activity helpers (len čo vieme spoľahlivo z tvojich rows) ----

function fmtMinutesFromSeconds(seconds?: number | null): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return null;
  return `${Math.round(seconds / 60)} min`;
}

function fmtKmFromMeters(m?: number | null): string | null {
  if (typeof m !== "number" || !Number.isFinite(m) || m <= 0) return null;
  return `${(m / 1000).toFixed(2)} km`;
}

export default function DayDetail({
  selectedIso,
  selectedLabel,
  actRows,
  planRowsForDay,
  externalRows,
  safeSportKey,
  sportColors,
  setFocusedActivityId,
  actMap,
}: Props) {
  const todayIso = new Date().toISOString().slice(0, 10);

  // -------------------- ACTIVITIES (for day) --------------------

  const activitiesForDay = React.useMemo(() => {
    const list = actRows.filter((r: any) => toIsoDay(r.date) === selectedIso);

    // sort: time_start_local if exists, else date
    list.sort((a: any, b: any) => String(a.start_time_local || a.date).localeCompare(String(b.start_time_local || b.date)));

    return list;
  }, [actRows, selectedIso]);

  const activitySports = React.useMemo(() => {
    const s = new Set<string>();
    for (const r of activitiesForDay) {
      s.add(safeSportKey((r as any).sport || (r as any).sport_type_fe || "other"));
    }
    return s;
  }, [activitiesForDay, safeSportKey]);

  // -------------------- EXTERNALS (for day, deduped by activity sport) --------------------

  const externalsForDay = React.useMemo(() => {
    const list = externalRows
      .filter((ev) => {
        const dIso = toIsoDay((ev as any).occurrence_date || (ev as any).single_date || "");
        if (dIso !== selectedIso) return false;
        const sport = safeSportKey((ev as any).sport);
        return !activitySports.has(sport);
      })
      .map((ev, idx) => {
        const time = (ev as any).start_time_local ? String((ev as any).start_time_local) : null;
        const sport = safeSportKey((ev as any).sport);

        const status: PlanStatus = selectedIso < todayIso ? "done" : "planned";

        const item: UnifiedSessionItem = {
          key: `external:${String(ev.id ?? idx)}`,
          kind: "external",
          id: Number(ev.id ?? 0) || 0,
          sport,
          dateIso: selectedIso,
          status,
          title: String((ev as any).title || "External event"),
          time,
          notes: (ev as any).notes ? String((ev as any).notes) : null,
          // detail link: externals stránka s filtrom na deň
          onOpen: () => {
            // necháme parent/route riešiť inde – zatiaľ nič
          },
        };

        return item;
      })
      .sort((a, b) => sortTime(a.time, b.time));

    return list;
  }, [externalRows, selectedIso, todayIso, activitySports, safeSportKey]);

  // -------------------- PLANS (for day) --------------------

  const plansPlannedForDay = React.useMemo(() => {
    // planned = nemá activity_id
    const raw = planRowsForDay.filter(
      (p: any) => p.activity_id == null || Number.isNaN(Number(p.activity_id))
    );

    // dedupe: ak existuje activity pre sport, skryť plán
    const deduped = raw.filter((p: any) => {
      const sess: AnyObj = p.payload ?? p;
      const sport = safeSportKey((p as any).sport || detectSport(sess) || "other");
      return !activitySports.has(sport);
    });

    return deduped.map((p: any) => {
      const sess: AnyObj = p.payload ?? p;
      const sport = safeSportKey((p as any).sport || detectSport(sess) || "other");

      const status: PlanStatus = planStatusForDate(selectedIso, todayIso, null);

      const item: UnifiedSessionItem = {
        key: `plan:${String(p.id)}`,
        kind: "plan",
        id: Number(p.id ?? 0) || 0,
        sport,
        dateIso: selectedIso,
        status,
        title: String(sess.title || sess.name || sess.session_type || p.title || "Plán"),
        time: null,
        notes: sess.notes ? String(sess.notes) : null,
      };

      return item;
    });
  }, [planRowsForDay, selectedIso, todayIso, activitySports, safeSportKey]);

  const plansDoneFallbackForDay = React.useMemo(() => {
    // done = má activity_id, ALE aktivitu nemáme v actMap (ináč ju skryjeme)
    const raw = planRowsForDay.filter(
      (p: any) => p.activity_id != null && !Number.isNaN(Number(p.activity_id))
    );

    const fallback = raw.filter((p: any) => {
      const actId = Number(p.activity_id);
      return !actMap.has(actId);
    });

    return fallback.map((p: any) => {
      const sess: AnyObj = p.payload ?? p;
      const sport = safeSportKey((p as any).sport || detectSport(sess) || "other");
      const actId = Number(p.activity_id);

      const item: UnifiedSessionItem = {
        key: `planDoneFallback:${String(p.id)}`,
        kind: "plan",
        id: Number(p.id ?? 0) || 0,
        sport,
        dateIso: selectedIso,
        status: "done",
        title: String(sess.title || sess.name || sess.session_type || p.title || "Plán"),
        time: null,
        notes: sess.notes ? String(sess.notes) : null,
        activityId: Number.isFinite(actId) ? actId : null,
      };

      return item;
    });
  }, [planRowsForDay, selectedIso, actMap, safeSportKey]);

  // -------------------- MAP TO UNIFIED ITEMS (Past/Planned) --------------------

  const activityItems = React.useMemo((): UnifiedSessionItem[] => {
    return activitiesForDay.map((r: any) => {
      const sport = safeSportKey((r as any).sport || (r as any).sport_type_fe || "other");
      const id = Number((r as any).activity_id);
      const name = String((r as any).name || "Activity");

      const time = (r as any).start_time_local
        ? String((r as any).start_time_local)
        : null;

      const dist = fmtKmFromMeters((r as any).distance_m);
      const dur = fmtMinutesFromSeconds((r as any).moving_time_s ?? (r as any).moving_time);

      const notes =
        (r as any).description ? String((r as any).description) : null;

      const item: UnifiedSessionItem = {
        key: `activity:${String(id)}`,
        kind: "activity",
        id: Number.isFinite(id) ? id : 0,
        sport,
        dateIso: selectedIso,
        status: "done",
        title: name,
        time,
        notes,
        activitySummary: [dist, dur].filter(Boolean).join(" · ") || null,
        onOpen: () => {
          if (Number.isFinite(id)) setFocusedActivityId(id);
        },
        activityId: Number.isFinite(id) ? id : null,
      };

      return item;
    });
  }, [activitiesForDay, safeSportKey, selectedIso, setFocusedActivityId]);

  const plannedItems = React.useMemo(() => {
    // planned bucket: plány + externals (už deduped), a len ak date nie je v minulosti
    const out: UnifiedSessionItem[] = [];

    // externals: ak sú v minulosti, pôjdu do past
    for (const e of externalsForDay) {
      if (e.dateIso < todayIso) continue;
      out.push(e);
    }

    for (const p of plansPlannedForDay) {
      // ak plán je "missed" (date < today), pôjde do past
      if (p.dateIso < todayIso) continue;
      out.push(p);
    }

    // today planned items nechávame v planned
    return out;
  }, [externalsForDay, plansPlannedForDay, todayIso]);

  const pastItems = React.useMemo(() => {
    const out: UnifiedSessionItem[] = [];

    // aktivity sú vždy “past/done”
    out.push(...activityItems);

    // externals v minulosti
    for (const e of externalsForDay) {
      if (e.dateIso < todayIso) out.push(e);
    }

    // missed plány v minulosti
    for (const p of plansPlannedForDay) {
      if (p.dateIso < todayIso) out.push(p);
    }

    // fallback done plány, ak chýba activity row
    out.push(...plansDoneFallbackForDay);

    // rozumné radenie: time, potom title
    out.sort((a, b) => {
      const t = sortTime(a.time, b.time);
      if (t !== 0) return t;
      return String(a.title).localeCompare(String(b.title));
    });

    return out;
  }, [activityItems, externalsForDay, plansPlannedForDay, plansDoneFallbackForDay, todayIso]);

  return (
    <div className="mt-3 ml-1 space-y-3">
      <div className={[CARD, "space-y-2", "p-3 md:p-4"].join(" ")}>
        <div className="flex items-center justify-between mb-1.5">
          <h3 className="text-sm font-semibold">Deň — {selectedLabel}</h3>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <PastSessionsPanel
            selectedIso={selectedIso}
            selectedLabel={selectedLabel}
            rows={pastItems}
            sportColors={sportColors}
            todayIso={todayIso}
          />

          <PlannedSessionsPanel
            selectedIso={selectedIso}
            selectedLabel={selectedLabel}
            rows={plannedItems}
            sportColors={sportColors}
            todayIso={todayIso}
          />
        </div>
      </div>
    </div>
  );
}