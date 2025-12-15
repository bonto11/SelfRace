// src/features/calendar/detail/buildDayBuckets.ts
import type { ExternalEvent } from "@/features/coach/types/externalEvents";
import type { UnifiedSession, UnifiedStatus } from "@/features/calendar/detail/unifiedSession";

// malé helpers
function fmtMinutes(min?: number | null): string | null {
  if (typeof min !== "number" || !Number.isFinite(min) || min <= 0) return null;
  return `${Math.round(min)} min`;
}
function fmtDistanceKm(m?: number | null): string | null {
  if (typeof m !== "number" || !Number.isFinite(m) || m <= 0) return null;
  return `${(m / 1000).toFixed(2)} km`;
}
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

type Args = {
  selectedIso: string;
  actRows: any[];
  planRowsForDay: any[];
  externalRows: ExternalEvent[];
  safeSportKey: (v: any) => string;
};

export function buildDayBuckets({
  selectedIso,
  actRows,
  planRowsForDay,
  externalRows,
  safeSportKey,
}: Args): { past: UnifiedSession[]; planned: UnifiedSession[] } {
  const tIso = todayIso();

  // --- activities for day ---
  const actsForDay = actRows
    .filter((r) => String(r.date).slice(0, 10) === selectedIso)
    .map((r) => {
      const aid = Number(r.activity_id);
      const sport = safeSportKey((r as any).sport || (r as any).sport_type_fe || "other");

      const dist = fmtDistanceKm(r.distance_m ?? null);
      const dur = fmtMinutes((r.moving_time_s ?? 0) / 60);

      const kpis = [
        dur ? { label: "TIME", value: dur } : null,
        dist ? { label: "DIST", value: dist } : null,
        r.average_heartrate_bpm != null ? { label: "AVG HR", value: String(r.average_heartrate_bpm) } : null,
        r.max_heartrate_bpm != null ? { label: "MAX HR", value: String(r.max_heartrate_bpm) } : null,
      ].filter(Boolean) as any[];

      const title = String(r.name || "Activity");
      const subtitle = dist ? `Distance ${dist}` : dur ? `Time ${dur}` : null;

      const status: UnifiedStatus = "done";

      const item: UnifiedSession = {
        kind: "activity",
        id: `a:${aid}`,
        dateIso: selectedIso,
        sport,
        title,
        subtitle,
        status,
        kpis,
        notes: null,
        activityId: aid,
        raw: r,
      };
      return item;
    });

  const actSports = new Set<string>(actsForDay.map((a) => a.sport));

  // --- plans (for day) ---
  const plansForDay = planRowsForDay
    .filter((p) => String(p.plan_date).slice(0, 10) === selectedIso)
    .map((p) => {
      const sess = (p as any).payload ?? p;
      const sport = safeSportKey((p as any).sport || sess?.sport || "other");

      const dIso = selectedIso;
      const hasAct = p.activity_id != null && !Number.isNaN(Number(p.activity_id));
      const status: UnifiedStatus = hasAct ? "done" : dIso < tIso ? "missed" : "planned";

      // jednoduché titulky (nespoliehame sa na PlanSingle)
      const title =
        String(sess?.title || sess?.name || sess?.session_type || p.title || "Plán");

      const dur =
        typeof sess?.duration_min === "number"
          ? `${sess.duration_min} min`
          : typeof p.duration_min === "number"
          ? `${p.duration_min} min`
          : null;

      const intensity = sess?.intensity ?? p.intensity ?? null;

      const kpis = [
        dur ? { label: "DURATION", value: dur } : null,
        intensity ? { label: "INTENSITY", value: String(intensity) } : null,
      ].filter(Boolean) as any[];

      const notes =
        sess?.notes ??
        sess?.structure?.main?.notes ??
        p?.notes ??
        null;

      const item: UnifiedSession = {
        kind: "plan",
        id: `p:${String(p.id ?? `${dIso}:${sport}:${title}`)}`,
        dateIso: dIso,
        sport,
        title,
        subtitle: dur ? `Plán · ${dur}` : "Plán",
        status,
        kpis,
        notes: notes ? String(notes) : null,
        activityId: hasAct ? Number(p.activity_id) : null,
        raw: p,
      };
      return item;
    });

  // --- externals (expandované cez occurrence_date) ---
  const externalsForDay = externalRows
    .filter((ev) => {
      const dIso = String((ev as any).occurrence_date || ev.single_date || "").slice(0, 10);
      return dIso === selectedIso;
    })
    .map((ev, idx) => {
      const sport = safeSportKey(ev.sport);
      const t = (ev as any).start_time_local ? String((ev as any).start_time_local) : null;
      const dur = fmtMinutes((ev as any).duration_min ?? null);

      const title = String(ev.title || "External");
      const subtitle = [t, dur].filter(Boolean).join(" · ") || "External";

      const item: UnifiedSession = {
        kind: "external",
        id: `e:${String(ev.id ?? idx)}`,
        dateIso: selectedIso,
        sport,
        title,
        subtitle,
        status: selectedIso < tIso ? "done" : "planned",
        kpis: [
          dur ? { label: "DURATION", value: dur } : null,
          t ? { label: "TIME", value: t } : null,
        ].filter(Boolean) as any[],
        notes: ev.notes ? String(ev.notes) : null,
        raw: ev,
      };
      return item;
    });

  // --- DEDUPE pravidlo ---
  // Ak existuje activity pre šport S → schovaj plan/external S (done plan ani tak netreba, lebo activity už existuje)
  const plansDeduped = plansForDay.filter((p) => !actSports.has(p.sport));
  const externalsDeduped = externalsForDay.filter((e) => !actSports.has(e.sport));

  // --- buckets ---
  const past: UnifiedSession[] = [];
  const planned: UnifiedSession[] = [];

  for (const a of actsForDay) past.push(a);

  for (const p of plansDeduped) {
    if (p.status === "planned") planned.push(p);
    else if (p.status === "missed") planned.push(p); // ty chceš planned tabuľku aj s missed (minulosť bez aktivity)
    else past.push(p);
  }

  for (const e of externalsDeduped) {
    // externals dávame do planned/past podľa dátumu
    if (selectedIso < tIso) past.push(e);
    else planned.push(e);
  }

  // stabilné radenie: activity > plan > external (len pre čitateľnosť)
  const kindOrder: Record<string, number> = { activity: 0, plan: 1, external: 2 };
  const sort = (arr: UnifiedSession[]) =>
    arr.sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind] || a.title.localeCompare(b.title));

  return { past: sort(past), planned: sort(planned) };
}