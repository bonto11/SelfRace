// src/features/calendar/detail/buildDayBuckets.ts
import type { ExternalEvent } from "@/features/coach/types/externalEvents";
import type { SessionCardItem, KPI, PlanStatus } from "@/shared/components/SessionCard";

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

function toPlanStatus(v: any): PlanStatus {
  if (v === "done" || v === "missed" || v === "planned") return v;
  return "planned";
}

function asKpis(arr: (KPI | null | undefined)[]): KPI[] {
  return arr.filter(Boolean) as KPI[];
}

export function buildDayBuckets({
  selectedIso,
  actRows,
  planRowsForDay,
  externalRows,
  safeSportKey,
}: Args): { past: SessionCardItem[]; planned: SessionCardItem[] } {
  const tIso = todayIso();

  // --- activities for day ---
  const actsForDay: SessionCardItem[] = actRows
    .filter((r) => String(r.date).slice(0, 10) === selectedIso)
    .map((r) => {
      const aid = Number(r.activity_id);
      const sport = safeSportKey((r as any).sport || (r as any).sport_type_fe || "other");

      const dist = fmtDistanceKm(r.distance_m ?? null);
      const dur = fmtMinutes((r.moving_time_s ?? 0) / 60);

      const kpis = asKpis([
        dur ? { label: "TIME", value: dur } : null,
        dist ? { label: "DIST", value: dist } : null,
        r.average_heartrate_bpm != null ? { label: "AVG HR", value: String(r.average_heartrate_bpm) } : null,
        r.max_heartrate_bpm != null ? { label: "MAX HR", value: String(r.max_heartrate_bpm) } : null,
      ]);

      const title = String(r.name || "Activity");
      const subtitle = dist ? `Distance ${dist}` : dur ? `Time ${dur}` : null;

      return {
        kind: "activity",
        id: `a:${aid}`,
        dateIso: selectedIso,
        sport,
        title,
        subtitle,
        kpis,
        notes: null,

        activityId: aid,

        // fallbacky (ak summary ešte nie je v provider cache)
        timeStr: dur ?? null,
        distanceStr: dist ?? null,
        avgHr: r.average_heartrate_bpm ?? null,
        maxHr: r.max_heartrate_bpm ?? null,
      };
    });

  const actSports = new Set<string>(actsForDay.map((a: any) => a.sport));

  // --- plans (for day) ---
  const plansForDay: SessionCardItem[] = planRowsForDay
    .filter((p) => String(p.plan_date).slice(0, 10) === selectedIso)
    .map((p) => {
      const sess = (p as any).payload ?? p;
      const sport = safeSportKey((p as any).sport || sess?.sport || "other");

      const dIso = selectedIso;
      const hasAct = p.activity_id != null && !Number.isNaN(Number(p.activity_id));
      const status: PlanStatus = hasAct ? "done" : dIso < tIso ? "missed" : "planned";

      const title = String(sess?.title || sess?.name || sess?.session_type || p.title || "Plán");

      const durStr =
        typeof sess?.duration_min === "number"
          ? `${sess.duration_min} min`
          : typeof p.duration_min === "number"
          ? `${p.duration_min} min`
          : null;

      const intensity = sess?.intensity ?? p.intensity ?? null;

      // (voliteľné) target – skús vyčítať z pár miest
      const target =
        sess?.target ??
        sess?.target_hr_bpm_range ??
        sess?.structure?.main?.target ??
        null;

      const planTarget =
        typeof target === "string"
          ? target
          : Array.isArray(target) && target.length === 2
          ? `HR ${target[0]}–${target[1]}`
          : target?.hr
          ? `HR ${target.hr[0]}–${target.hr[1]}`
          : target?.pace
          ? `pace ${target.pace}`
          : target?.power
          ? `power ${target.power}W`
          : null;

      const notes =
        sess?.notes ??
        sess?.structure?.main?.notes ??
        p?.notes ??
        null;

      const kpis = asKpis([
        durStr ? { label: "DURATION", value: durStr } : null,
        intensity ? { label: "INTENSITY", value: String(intensity) } : null,
        planTarget ? { label: "TARGET", value: String(planTarget) } : null,
      ]);

      return {
        kind: "plan",
        id: `p:${String(p.id ?? `${dIso}:${sport}:${title}`)}`,
        dateIso: dIso,
        sport,
        title,
        subtitle: durStr ? `Plán · ${durStr}` : "Plán",
        kpis,
        notes: notes ? String(notes) : null,

        status: toPlanStatus(status),

        planDur: durStr,
        planIntensity: intensity != null ? String(intensity) : null,
        planTarget: planTarget != null ? String(planTarget) : null,
        planNotes: notes ? String(notes) : null,

        planRaw: sess,
        planStructure: sess?.structure ?? null,
        planExercises: Array.isArray(sess?.exercises) ? sess.exercises : [], // ✅ nikdy null
      };
    });

  // --- externals (expandované cez occurrence_date) ---
  const externalsForDay: SessionCardItem[] = externalRows
    .filter((ev) => {
      const dIso = String((ev as any).occurrence_date || ev.single_date || "").slice(0, 10);
      return dIso === selectedIso;
    })
    .map((ev, idx) => {
      const sport = safeSportKey((ev as any).sport);
      const t = (ev as any).start_time_local ? String((ev as any).start_time_local) : null;
      const durMin = (ev as any).duration_min ?? null;
      const durTxt = fmtMinutes(durMin);

      const title = String((ev as any).title || "External");
      const subtitle = [t, durTxt].filter(Boolean).join(" · ") || "External";

      const kpis = asKpis([
        durTxt ? { label: "DURATION", value: durTxt } : null,
        t ? { label: "TIME", value: t } : null,
      ]);

      return {
        kind: "external",
        id: `e:${String((ev as any).id ?? idx)}`,
        dateIso: selectedIso,
        sport,
        title,
        subtitle,
        kpis,
        notes: (ev as any).notes ? String((ev as any).notes) : null,

        time: t,
        durationMin: typeof durMin === "number" ? durMin : null,
      };
    });

  // --- DEDUPE pravidlo ---
  // Ak existuje activity pre šport S → schovaj plan/external S
  const plansDeduped = plansForDay.filter((p: any) => !actSports.has(p.sport));
  const externalsDeduped = externalsForDay.filter((e: any) => !actSports.has(e.sport));

  // --- buckets ---
  const past: SessionCardItem[] = [];
  const planned: SessionCardItem[] = [];

  for (const a of actsForDay) past.push(a);

  for (const p of plansDeduped) {
    const st = (p as any).status;
    if (st === "planned" || st === "missed") planned.push(p);
    else past.push(p);
  }

  for (const e of externalsDeduped) {
    if (selectedIso < tIso) past.push(e);
    else planned.push(e);
  }

  // stabilné radenie
  const kindOrder: Record<string, number> = { activity: 0, plan: 1, external: 2 };
  const sort = (arr: SessionCardItem[]) =>
    arr.sort((a: any, b: any) => kindOrder[a.kind] - kindOrder[b.kind] || String(a.title).localeCompare(String(b.title)));

  return { past: sort(past), planned: sort(planned) };
}