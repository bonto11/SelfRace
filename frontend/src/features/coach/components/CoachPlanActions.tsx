// src/features/coach/utils/coachAnalyzePayload.ts
import type { CoachPrefs } from "@/features/coach/types/prefsTypes";
import type {
  AnalyzePayloadBE,
  RecentLoad,
  RecentLoadWeek,
} from "@/features/coach/types/coachApiTypes";

/** Postaví základ payloadu z CoachPrefs pre /coach/athlete/analyze/:user_id */
export function buildAnalyzePayloadFromPrefs(prefs: CoachPrefs): AnalyzePayloadBE {
  const weeks =
    typeof prefs.weeks === "number" && Number.isFinite(prefs.weeks)
      ? prefs.weeks
      : undefined;

  const plan_start_date =
    (prefs as any).start_date && (prefs as any).start_date !== ""
      ? (prefs as any).start_date
      : undefined;

  const main_sport =
    (prefs as any).main_sport ?? prefs.primary_sports?.[0] ?? undefined;

  const secondary_mix = (prefs as any).secondary_mix ?? [];

  const strength_settings = (prefs as any).strength_settings ?? null;

  const rules = (prefs as any).preferences ?? null;

  const blocks = {
    vo2max: !!(prefs as any).vo2max_training,
    threshold: !!(prefs as any).threshold_focus,
    ftp: !!(prefs as any).ftp_training,
  };

  // presný union typ, nie generic string
  const intensity_model: AnalyzePayloadBE["intensity_model"] =
    (prefs as any).polarized_model
      ? "polarized"
      : (prefs as any).pyramidal_model
      ? "pyramidal"
      : null;

  const zones = (prefs as any).zones ?? undefined;
  const thresholds = (prefs as any).thresholds ?? undefined;

  const legacy = {
    distance: prefs.distance,
    current_pace: prefs.current_pace,
    target_pace: prefs.target_pace,
  };

  const payload: AnalyzePayloadBE = {
    schema_version: 1,
    weeks,
    goal_kind: prefs.goal_kind ?? "improve_overall",
    plan_start_date,
    main_sport,
    secondary_mix,
    strength_settings,
    rules,
    blocks,
    intensity_model,
    zones,
    thresholds,
    legacy,
    // bests + recent_load doplníš až v komponentoch (CoachPlanActions)
  };

  return payload;
}

/* ------------ Recent load z ActivityDataProvider ------------ */

type ActivityRowLike = {
  date: string; // ISO
  moving_time_s?: number | null;
  moving_time?: number | null;
  sport?: string | null;
  sport_type_fe?: string | null;
};

/** Normalizácia stringu športu na run/ride/strength/other. */
function normSport(
  raw: string | null | undefined
): "run" | "ride" | "strength" | "other" {
  const s = (raw || "").toLowerCase();
  if (s.includes("run")) return "run";
  if (s.includes("ride") || s.includes("bike") || s.includes("cycle"))
    return "ride";
  if (s.includes("strength") || s.includes("gym") || s.includes("workout"))
    return "strength";
  return "other";
}

function startOfIsoWeek(d: Date): Date {
  // getDay(): 0 = Sun, ..., 6 = Sat → chceme Po=0
  const dow = (d.getDay() + 6) % 7;
  const res = new Date(d);
  res.setHours(0, 0, 0, 0);
  res.setDate(res.getDate() - dow);
  return res;
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

/**
 * Z aktivít za posledných `windowDays` vyrobíme weekly sumár pre AI.
 * Používa ActivityDataProvider rows (date, moving_time_s, sport/_type_fe).
 */
export function buildRecentLoadFromActivities(
  rows: ActivityRowLike[],
  windowDays = 42
): RecentLoad {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { schema_version: 1, window_days: windowDays, weeks: [] };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const from = addDays(today, -windowDays + 1);

  type WeekAgg = {
    week_start: Date;
    total_minutes: number;
    run_minutes: number;
    ride_minutes: number;
    strength_sessions: number;
    hard_sessions: number;
  };

  const map = new Map<string, WeekAgg>();

  for (const r of rows) {
    if (!r?.date) continue;
    const d = new Date(r.date);
    if (Number.isNaN(d.getTime())) continue;
    if (d < from || d > today) continue;

    const weekStart = startOfIsoWeek(d);
    const key = weekStart.toISOString().slice(0, 10);

    const agg =
      map.get(key) ??
      ({
        week_start: weekStart,
        total_minutes: 0,
        run_minutes: 0,
        ride_minutes: 0,
        strength_sessions: 0,
        hard_sessions: 0,
      } as WeekAgg);

    const sec =
      (typeof r.moving_time_s === "number" && r.moving_time_s > 0
        ? r.moving_time_s
        : typeof r.moving_time === "number" && r.moving_time > 0
        ? r.moving_time
        : 0) || 0;
    const mins = sec / 60;

    const sport = normSport(r.sport || r.sport_type_fe);

    agg.total_minutes += mins;

    if (sport === "run") {
      agg.run_minutes += mins;
      // jednoduchá heuristika: >60 min považuj ako “hard” (dočasne)
      if (mins >= 60) agg.hard_sessions += 1;
    } else if (sport === "ride") {
      agg.ride_minutes += mins;
    } else if (sport === "strength") {
      agg.strength_sessions += 1;
    }

    map.set(key, agg);
  }

  const weeksSorted = Array.from(map.values()).sort(
    (a, b) => a.week_start.getTime() - b.week_start.getTime()
  );

  if (weeksSorted.length === 0) {
    return { schema_version: 1, window_days: windowDays, weeks: [] };
  }

  // indexovanie: posledný týždeň = 0, predchádzajúci = -1, atď
  const weeks: RecentLoadWeek[] = weeksSorted.map((w, idx) => {
    const week_start_iso = w.week_start.toISOString().slice(0, 10);
    const week_end = addDays(w.week_start, 6);
    const week_end_iso = week_end.toISOString().slice(0, 10);
    const week_index_from_now = idx - (weeksSorted.length - 1);

    return {
      week_start_iso,
      week_end_iso,
      week_index_from_now,
      total_minutes: Math.round(w.total_minutes),
      run_minutes: Math.round(w.run_minutes),
      ride_minutes: Math.round(w.ride_minutes),
      strength_sessions: w.strength_sessions,
      hard_sessions: w.hard_sessions,
    };
  });

  return {
    schema_version: 1,
    window_days: windowDays,
    weeks,
  };
}