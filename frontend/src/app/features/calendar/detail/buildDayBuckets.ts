// src/features/calendar/detail/buildDayBuckets.ts
import type { ExternalEvent } from "@/app/features/coach/types/externalEvents";
import type {
  SessionCardItem,
  SessionItem,
  KPI,
  PlanStatus,
} from "@/app/shared/components/session/SessionCard";

/* ---------- small helpers (UI-friendly strings, no hardcoded colors) ---------- */

function fmtMinutes(min: number | null | undefined, t: any): string | null {
  if (typeof min !== "number" || !Number.isFinite(min) || min <= 0) return null;
  return `${Math.round(min)} ${t("common.units.min")}`;
}

function fmtDistanceKm(m: number | null | undefined, t: any): string | null {
  if (typeof m !== "number" || !Number.isFinite(m) || m <= 0) return null;
  return `${(m / 1000).toFixed(2)} ${t("common.units.km")}`;
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
  t: any;
};

function asKpis(arr: (KPI | null | undefined)[]): KPI[] {
  return arr.filter(Boolean) as KPI[];
}

export function buildDayBuckets({
  selectedIso,
  actRows,
  planRowsForDay,
  externalRows,
  safeSportKey,
  t,
}: Args): { past: SessionCardItem[]; planned: SessionCardItem[] } {
  const tIso = todayIso();

  // --- raw activities for day, indexed by activity_id ---
  const actRowsForDay = actRows
    .filter((r) => String(r.date).slice(0, 10) === selectedIso)
    .filter((r) => Number.isFinite(Number(r.activity_id)));

  const actByIdForDay = new Map<number, any>();
  for (const r of actRowsForDay) {
    actByIdForDay.set(Number(r.activity_id), r);
  }

  // helper: build activity-derived fields (kpis, subtitle, raw fallbacks) from an activity row
  function activityFields(r: any) {
    const dist = fmtDistanceKm(r.distance_m ?? null, t);
    const dur = fmtMinutes((r.moving_time_s ?? 0) / 60, t);
    const kpis = asKpis([
      dur ? { label: t("common.metrics.time"), value: dur } : null,
      dist ? { label: t("common.metrics.distance"), value: dist } : null,
      r.average_heartrate_bpm != null
        ? { label: t("common.metrics.hr_avg"), value: String(Math.round(r.average_heartrate_bpm)) }
        : null,
      r.max_heartrate_bpm != null
        ? { label: t("common.metrics.hr_max"), value: String(Math.round(r.max_heartrate_bpm)) }
        : null,
    ]);
    const subtitle = dist
      ? `${t("common.metrics.distance")} ${dist}`
      : dur
        ? `${t("common.metrics.time")} ${dur}`
        : null;

    return {
      kpis,
      subtitle,
      timeStr: dur ?? null,
      distanceStr: dist ?? null,
      avgHr: r.average_heartrate_bpm ?? null,
      maxHr: r.max_heartrate_bpm ?? null,
      name: String(r.name || t("activities.title")),
    };
  }

  // --- plans (for day) ---
  const usedActivityIds = new Set<number>();

  const plansForDay: SessionItem[] = planRowsForDay
    .filter((p) => String(p.plan_date).slice(0, 10) === selectedIso)
    .map((p) => {
      const sess = (p as any).payload ?? p;
      const sport = safeSportKey((p as any).sport || sess?.sport || "other");

      const dIso = selectedIso;

      const rawActId = p.activity_id;
      const hasAct =
        rawActId != null &&
        !Number.isNaN(Number(rawActId)) &&
        actByIdForDay.has(Number(rawActId));

      const activityId = hasAct ? Number(rawActId) : null;
      if (activityId != null) usedActivityIds.add(activityId);

      const status: PlanStatus = activityId != null ? "done" : dIso < tIso ? "missed" : "planned";

      const title = String(
        sess?.title || sess?.name || sess?.session_type || p.title || t("coach.plan"),
      );

      const durStr =
        typeof sess?.duration_min === "number"
          ? `${sess.duration_min} ${t("common.units.min")}`
          : typeof p.duration_min === "number"
            ? `${p.duration_min} ${t("common.units.min")}`
            : null;

      const intensity = sess?.intensity ?? p.intensity ?? null;

      const target =
        sess?.target ??
        sess?.target_hr_bpm_range ??
        sess?.structure?.main?.target ??
        null;

      const planTarget =
        typeof target === "string"
          ? target
          : Array.isArray(target) && target.length === 2
            ? `${t("common.metrics.hr")} ${target[0]}–${target[1]}`
            : target?.hr
              ? `${t("common.metrics.hr")} ${target.hr[0]}–${target.hr[1]}`
              : target?.pace
                ? `${t("common.metrics.pace")} ${target.pace}`
                : target?.power
                  ? `${t("common.metrics.power")} ${target.power}${t("common.units.power")}`
                  : null;

      const notes = sess?.notes ?? sess?.structure?.main?.notes ?? p?.notes ?? null;

      // ak je plán spárovaný s aktivitou, KPI/subtitle radšej ukážeme z aktivity
      // (reálne odjazdené hodnoty sú užitočnejšie ako plánované), plán detail si
      // svoje metriky zobrazí sám v PlanSessionDetail cez planDur/planIntensity/planTarget.
      const activityRow = activityId != null ? actByIdForDay.get(activityId) : null;
      const actFields = activityRow ? activityFields(activityRow) : null;

      const planKpis = asKpis([
        durStr ? { label: t("common.metrics.duration"), value: durStr } : null,
        intensity ? { label: t("common.metrics.intensity"), value: String(intensity) } : null,
        planTarget ? { label: t("common.metrics.target"), value: String(planTarget) } : null,
      ]);

      const item: SessionItem = {
        kind: "session",
        id: activityId != null ? `s:${p.id}:${activityId}` : `s:${p.id}`,
        dateIso: dIso,
        sport,
        title: actFields ? actFields.name : title,
        subtitle: actFields ? actFields.subtitle : durStr ? `${t("coach.plan")} · ${durStr}` : t("coach.plan"),
        kpis: actFields ? actFields.kpis : planKpis,
        notes: notes ? String(notes) : null,

        planId: p.id ?? null,
        activityId: activityId,
        status,

        planDur: durStr,
        planIntensity: intensity != null ? String(intensity) : null,
        planTarget: planTarget != null ? String(planTarget) : null,
        planNotes: notes ? String(notes) : null,

        planRaw: sess,
        planStructure: sess?.structure ?? null,
        planExercises: Array.isArray(sess?.exercises) ? sess.exercises : [],

        // activity-derived fallbacky, ak je spárované
        timeStr: actFields?.timeStr ?? null,
        distanceStr: actFields?.distanceStr ?? null,
        avgHr: actFields?.avgHr ?? null,
        maxHr: actFields?.maxHr ?? null,
      };

      return item;
    });

  // --- activities for day, OKREM tých, ktoré už boli spárované s plánom vyššie ---
  const actsForDay: SessionItem[] = actRowsForDay
    .filter((r) => !usedActivityIds.has(Number(r.activity_id)))
    .map((r) => {
      const aid = Number(r.activity_id);
      const sport = safeSportKey((r as any).sport || (r as any).sport_type_fe || "other");
      const fields = activityFields(r);

      const item: SessionItem = {
        kind: "session",
        id: `s:a:${aid}`,
        dateIso: selectedIso,
        sport,
        title: fields.name,
        subtitle: fields.subtitle,
        kpis: fields.kpis,
        notes: null,

        planId: null,
        activityId: aid,

        timeStr: fields.timeStr,
        distanceStr: fields.distanceStr,
        avgHr: fields.avgHr,
        maxHr: fields.maxHr,
      };

      return item;
    });

  const actSports = new Set<string>(
    [...actsForDay, ...plansForDay.filter((p) => p.activityId != null)].map((a) => a.sport),
  );

  // --- externals (expanded via occurrence_date / single_date) ---
  const externalsForDay: SessionCardItem[] = externalRows
    .filter((ev) => {
      const dIso = String((ev as any).occurrence_date || ev.single_date || "").slice(0, 10);
      return dIso === selectedIso;
    })
    .map((ev, idx) => {
      const sport = safeSportKey((ev as any).sport);
      const ti = (ev as any).start_time_local ? String((ev as any).start_time_local) : null;
      const durMin = (ev as any).duration_min ?? null;
      const durTxt = fmtMinutes(durMin, t);

      const title = String((ev as any).title || t("calendar.external"));
      const subtitle = [ti, durTxt].filter(Boolean).join(" · ") || t("calendar.external");

      const kpis = asKpis([
        durTxt ? { label: t("common.metrics.duration"), value: durTxt } : null,
        ti ? { label: t("common.metrics.duration"), value: ti } : null,
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

        time: ti,
        durationMin: typeof durMin === "number" ? durMin : null,
      } as SessionCardItem;
    });

  // --- DEDUPE (vizuálne čistenie) ---
  // plán bez priradenej aktivity pre šport, ktorý už má aktivitu v ten deň, sa neduplikuje
  const plansDeduped = plansForDay.filter((p) => p.activityId != null || !actSports.has(p.sport));
  const externalsDeduped = externalsForDay.filter((e: any) => !actSports.has(e.sport));

  // --- buckets ---
  const past: SessionCardItem[] = [];
  const planned: SessionCardItem[] = [];

  for (const a of actsForDay) past.push(a);

  for (const p of plansDeduped) {
    const st = p.status;
    if (st === "planned" || st === "missed") planned.push(p);
    else past.push(p);
  }

  for (const e of externalsDeduped) {
    if (selectedIso < tIso) past.push(e);
    else planned.push(e);
  }

  // stable sort
  const kindOrder: Record<string, number> = { session: 0, external: 2, bests: 1 };
  const sort = (arr: SessionCardItem[]) =>
    arr.sort(
      (a: any, b: any) =>
        (kindOrder[a.kind] ?? 9) - (kindOrder[b.kind] ?? 9) ||
        String(a.title).localeCompare(String(b.title)),
    );

  return { past: sort(past), planned: sort(planned) };
}