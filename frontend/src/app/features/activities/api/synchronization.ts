// src/features/activities/api/activities.ts
import { callBackend } from "@/app/shared/utils/callBackend";
import {
  WeeklyLoadRow,
  WeeklyLoadApiResponse,
  WeeklyLoadOptions,
} from "@/app/features/activities/types/WeeklyLoad";

import {
  WeeklyMonoStrainOptions,
  WeeklyMonoStrainRow,
  WeeklyMonoStrainApiResponse,
} from "@/app/features/activities/types/MonoStrain";

import {
  SyncActivitiesOptions,
  SyncActivitiesStats,
  SyncActivitiesResponse,
} from "@/app/features/activities/types/synchronization";

import { ActivityDetailExtra } from "@/app/features/activities/types/activities";

/**
 * GET /analytics/weekly/{user_id}?weeks=&sport=
 * Normalizuje odpoveď na WeeklyMonoStrainRow[]
 */
export async function apiGetWeeklyMonoStrain(
  userId: number,
  opts: WeeklyMonoStrainOptions = {}
): Promise<WeeklyMonoStrainRow[]> {
  if (!userId) {
    return [];
  }

  const params = new URLSearchParams();
  if (opts.weeks != null) params.set("weeks", String(opts.weeks));
  if (opts.sport) params.set("sport", opts.sport);

  const path = `/analytics/weekly/${encodeURIComponent(String(userId))}${
    params.toString() ? `?${params.toString()}` : ""
  }`;

  const json = await callBackend<WeeklyMonoStrainApiResponse>(path, {
    method: "GET",
    cache: "no-store",
  });

  const raw: any[] = Array.isArray(json?.weeks)
    ? json.weeks
    : Array.isArray((json as any)?.data)
    ? (json as any).data
    : [];

  return raw.map((w) => ({
    week: w.week ?? w.iso_week ?? w.label ?? "",
    label: (w.label ?? w.week ?? "") as string,
    start: w.start ?? "",
    end: w.end ?? "",
    monotony: w.monotony ?? {},
    strain: w.strain ?? {},
  }));
}

function wlNum(v: any): number {
  return Number.isFinite(+v) ? +v : 0;
}

function wlRangeLabel(start?: string, end?: string): string {
  if (!start || !end) return "";
  const s = new Date(start);
  const e = new Date(end);
  const sd = s.getDate();
  const sm = s.getMonth() + 1;
  const ed = e.getDate();
  const em = e.getMonth() + 1;
  return sm === em ? `${sd}–${ed}.${em}.` : `${sd}.${sm}.–${ed}.${em}.`;
}

/**
 * GET /analytics/weekly/{user_id}?weeks=&sport=
 * Normalizuje odpoveď na WeeklyLoadRow[]
 */
export async function apiGetWeeklyLoad(
  userId: number,
  opts: WeeklyLoadOptions = {}
): Promise<WeeklyLoadRow[]> {
  if (!userId) {
    return [];
  }

  const params = new URLSearchParams();
  if (opts.weeks != null) params.set("weeks", String(opts.weeks));
  if (opts.sport) params.set("sport", opts.sport);

  const path = `/analytics/weekly/${encodeURIComponent(String(userId))}${
    params.toString() ? `?${params.toString()}` : ""
  }`;

  const json = await callBackend<WeeklyLoadApiResponse>(path, {
    method: "GET",
    cache: "no-store",
  });

  const raw: any[] = Array.isArray(json?.weeks)
    ? json.weeks
    : Array.isArray((json as any)?.data)
    ? (json as any).data
    : [];

  return raw.map((w) => ({
    week: w.week ?? w.iso_week ?? w.label ?? "",
    label: wlRangeLabel(w.start, w.end) || (w.label ?? w.week ?? ""),
    start: w.start ?? "",
    end: w.end ?? "",
    km_run: wlNum(w.km_run ?? w.run_km),
    km_ride: wlNum(w.km_ride ?? w.ride_km),
    km_mixed: wlNum(w.km_mixed),
    km_skate: wlNum(w.km_skate),
    time_run_min: wlNum(w.time_run_min ?? w.run_min),
    time_ride_min: wlNum(w.time_ride_min ?? w.ride_min),
    time_strength_min: wlNum(
      w.time_strength_min ?? w.strength_min ?? w.gym_min
    ),
    time_mixed_min: wlNum(w.time_mixed_min),
    time_skate_min: wlNum(w.time_skate_min),
    time_other_min: wlNum(w.time_other_min ?? w.other_min),
    trimp_run: wlNum(w.trimp_run ?? w.run_trimp),
    trimp_ride: wlNum(w.trimp_ride ?? w.ride_trimp),
    trimp_strength: wlNum(w.trimp_strength ?? w.strength_trimp),
    trimp_mixed: wlNum(w.trimp_mixed),
    trimp_skate: wlNum(w.trimp_skate),
    trimp_other: wlNum(w.trimp_other ?? w.other_trimp),
  }));
}

// 4) PARETO WIDGET
export async function apiFetchParetoWidget(
  userId: number,
  days: number,
  sportCsv: string | null
): Promise<{
  easy_min: number;
  hard_min: number;
  total_min: number;
  days: number;
} | null> {
  if (!userId) return null;

  const q = new URLSearchParams({ days: String(days) });
  if (sportCsv) q.set("sport", sportCsv);

  const path = `/analytics/pareto8020/widget/${encodeURIComponent(
    String(userId)
  )}?${q.toString()}`;
  console.debug("[activityApi][paretoWidget] ->", path);

  const js = await callBackend<any>(path, {
    method: "GET",
    cache: "no-store",
  });

  return js?.data ?? null;
}

// 5) PARETO TREND
export async function apiFetchParetoTrend(
  userId: number,
  weeks: number,
  sportCsv: string | null
): Promise<
  Array<{
    label: string;
    easy_min: number;
    hard_min: number;
    easy_pct: number;
    hard_pct: number;
    start?: string;
    end?: string;
  }>
> {
  if (!userId) return [];

  const q = new URLSearchParams({ weeks: String(weeks) });
  if (sportCsv) q.set("sport", sportCsv);

  const path = `/analytics/pareto8020/${encodeURIComponent(
    String(userId)
  )}?${q.toString()}`;
  console.debug("[activityApi][paretoTrend] ->", path);

  const js = await callBackend<any>(path, {
    method: "GET",
    cache: "no-store",
  });

  const rws = Array.isArray(js?.data) ? js.data : [];
  return rws;
}

// 2) DETAIL (laps + splits)
export async function apiFetchDetail(
  userId: number,
  activityId: number
): Promise<ActivityDetailExtra> {
  if (!userId || !activityId) {
    return { laps: [], splits: [] };
  }

  const path = `/analytics/activitiesDetail/${encodeURIComponent(
    String(userId)
  )}/${encodeURIComponent(String(activityId))}`;

  const json = await callBackend<any>(path, {
    method: "GET",
    cache: "no-store",
  });

  return {
    laps: Array.isArray(json?.laps) ? json.laps : [],
    splits: Array.isArray(json?.splits) ? json.splits : [],
  };
}

/**
 * POST /synchronization/{user_id}
 * Sync Strava aktivit (summary + detaily + enrichment + plan_match)
 * – ide cez JWT (callBackend).
 */
export async function apiSyncActivities(
  userId: number,
  opts: SyncActivitiesOptions = {}
): Promise<SyncActivitiesStats> {
  if (!userId) {
    throw new Error("Missing userId for apiSyncActivities");
  }

  const body = {
    force_last_days: opts.forceLastDays ?? 30,
    fetch_details: opts.fetchDetails ?? true,
  };

  const path = `/synchronization/${encodeURIComponent(String(userId))}`;

  const json = await callBackend<SyncActivitiesResponse>(path, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!json?.success) {
    const msg =
      (json as any)?.detail ||
      (json as any)?.error ||
      (json as any)?.note ||
      "Synchronization failed";
    throw new Error(msg);
  }

  return json.stats;
}