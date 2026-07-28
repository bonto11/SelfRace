// src/features/activities/api/analytics_activities.ts
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
import type { StreamsData, ActivityRow } from "@/app/features/activities/types/activities";
import type { ParetoTrendResponse } from "@/app/features/activities/types/pareto";
import type { ActivityExtrasCombined } from "@/app/features/activities/types/activities";
import type { ActivityEnrichment } from "@/app/features/activities/types/activities_enrichment";

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

/* ========================= WEEKLY ========================= */

export async function apiGetWeeklyMonoStrain(
  userId: number,
  opts: WeeklyMonoStrainOptions = {},
): Promise<WeeklyMonoStrainRow[]> {
  if (!userId) throw new Error("api.activities.missingUserId");

  const params = new URLSearchParams();
  if (opts.weeks != null) params.set("weeks", String(opts.weeks));
  if (opts.sport) params.set("sport", opts.sport);

  const path = `/analytics/weekly/${encodeURIComponent(String(userId))}${
    params.toString() ? `?${params.toString()}` : ""
  }`;

  try {
    const json = await callBackend<WeeklyMonoStrainApiResponse>(path, {
      method: "GET",
      cache: "no-store",
    });
    const raw: any[] = Array.isArray(json?.weeks)
      ? json.weeks
      : Array.isArray((json as any)?.data)
        ? (json as any).data
        : [];
    return raw.map((w: any) => ({
      week: w.week ?? w.iso_week ?? w.label ?? "",
      label: (w.label ?? w.week ?? "") as string,
      start: w.start ?? "",
      end: w.end ?? "",
      monotony: w.monotony ?? {},
      strain: w.strain ?? {},
    }));
  } catch (err: any) {
    console.error("[Analytics API] apiGetWeeklyMonoStrain ERROR", err);
    throw new Error("api.activities.monoStrainFetchFailed");
  }
}

export async function apiGetWeeklyLoad(
  userId: number,
  opts: WeeklyLoadOptions = {},
): Promise<WeeklyLoadRow[]> {
  if (!userId) throw new Error("api.activities.missingUserId");

  const params = new URLSearchParams();
  if (opts.weeks != null) params.set("weeks", String(opts.weeks));
  if (opts.sport) params.set("sport", opts.sport);

  const path = `/analytics/weekly/${encodeURIComponent(String(userId))}${
    params.toString() ? `?${params.toString()}` : ""
  }`;

  try {
    const json = await callBackend<WeeklyLoadApiResponse>(path, {
      method: "GET",
      cache: "no-store",
    });
    const raw: any[] = Array.isArray(json?.weeks)
      ? json.weeks
      : Array.isArray((json as any)?.data)
        ? (json as any).data
        : [];
    return raw.map((w: any) => ({
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
      time_strength_min: wlNum(w.time_strength_min ?? w.strength_min ?? w.gym_min),
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
  } catch (err: any) {
    console.error("[Analytics API] apiGetWeeklyLoad ERROR", err);
    throw new Error("api.activities.weeklyLoadFetchFailed");
  }
}

/* ========================= PARETO ========================= */

export async function apiFetchParetoWidget(
  userId: number,
  days: number,
  sportCsv: string | null,
): Promise<{ easy_min: number; hard_min: number; total_min: number; days: number } | null> {
  if (!userId) throw new Error("api.activities.missingUserId");
  const q = new URLSearchParams({ days: String(days) });
  if (sportCsv) q.set("sport", sportCsv);
  const path = `/analytics/pareto8020/widget/${encodeURIComponent(String(userId))}?${q.toString()}`;
  try {
    const js = await callBackend<any>(path, { method: "GET", cache: "no-store" });
    return js?.data ?? null;
  } catch (err: any) {
    console.error("[Analytics API] apiFetchParetoWidget ERROR", err);
    throw new Error("api.activities.paretoFetchFailed");
  }
}

export async function apiFetchParetoTrend(
  userId: number,
  weeks: number,
  sportCsv: string | null,
): Promise<ParetoTrendResponse> {
  if (!userId) throw new Error("api.activities.missingUserId");
  const q = new URLSearchParams({ weeks: String(weeks) });
  if (sportCsv) q.set("sport", sportCsv);
  const path = `/analytics/pareto8020/${encodeURIComponent(String(userId))}?${q.toString()}`;
  try {
    const js = await callBackend<any>(path, { method: "GET", cache: "no-store" });
    const rawData = js?.data;
    if (rawData && typeof rawData === "object" && !Array.isArray(rawData) && rawData.trend) {
      return {
        trend: Array.isArray(rawData.trend) ? rawData.trend : [],
        availableSports: Array.isArray(rawData.available_sports) ? rawData.available_sports : [],
      };
    }
    return { trend: Array.isArray(rawData) ? rawData : [], availableSports: [] };
  } catch (err: any) {
    console.error("[Analytics API] apiFetchParetoTrend ERROR", err);
    throw new Error("api.activities.paretoFetchFailed");
  }
}

/* ========================= STREAMS + EXTRAS ========================= */

export async function apiFetchActivityStreams(
  userId: number,
  activityId: number,
  fetchIfMissing: boolean,
): Promise<{ streams: any; source: string; fetched: boolean } | null> {
  if (!userId) throw new Error("api.activities.missingUserId");
  if (!activityId) throw new Error("api.activities.missingActivityId");
  const q = new URLSearchParams();
  if (fetchIfMissing) q.set("fetch", "true");
  const path = `/analytics/activityStreams/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(activityId))}${q.toString() ? `?${q}` : ""}`;
  try {
    const js = await callBackend<any>(path, { method: "POST", cache: "no-store" });
    if (!js?.success) return null;
    return { streams: js.streams ?? null, source: js.source ?? "unknown", fetched: !!js.fetched };
  } catch (err: any) {
    console.error("[Analytics API] apiFetchActivityStreams ERROR", err);
    throw new Error("api.activities.streamsFetchFailed");
  }
}

export async function apiFetchActivityExtras(
  userId: number,
  activityId: number,
  fetchIfMissing: boolean,
): Promise<{ laps: any[]; splits: any[]; source: string; fetched: boolean } | null> {
  if (!userId) throw new Error("api.activities.missingUserId");
  if (!activityId) throw new Error("api.activities.missingActivityId");
  const q = new URLSearchParams();
  if (fetchIfMissing) q.set("fetch", "true");
  const path = `/analytics/activityExtras/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(activityId))}${q.toString() ? `?${q}` : ""}`;
  try {
    const js = await callBackend<any>(path, { method: "POST", cache: "no-store" });
    if (!js?.success) return null;
    return {
      laps: Array.isArray(js?.laps) ? js.laps : [],
      splits: Array.isArray(js?.splits) ? js.splits : [],
      source: js.source ?? "unknown",
      fetched: !!js.fetched,
    };
  } catch (err: any) {
    console.error("[Analytics API] apiFetchActivityExtras ERROR", err);
    throw new Error("api.activities.extrasFetchFailed");
  }
}

export async function apiFetchActivityExtrasCombined(
  userId: number,
  activityId: number,
  fetchIfMissing: boolean,
): Promise<ActivityExtrasCombined | null> {
  if (!userId) throw new Error("api.activities.missingUserId");
  if (!activityId) throw new Error("api.activities.missingActivityId");
  try {
    const [stRes, exRes] = await Promise.all([
      apiFetchActivityStreams(userId, activityId, fetchIfMissing).catch(() => null),
      apiFetchActivityExtras(userId, activityId, fetchIfMissing).catch(() => null),
    ]);
    const streams = (stRes?.streams ?? null) as StreamsData | null;
    const laps    = Array.isArray(exRes?.laps)   ? exRes!.laps   : [];
    const splits  = Array.isArray(exRes?.splits) ? exRes!.splits : [];
    const fetched = !!(stRes?.fetched || exRes?.fetched);
    const s1 = stRes?.source ?? "unknown";
    const s2 = exRes?.source ?? "unknown";
    return { streams, laps, splits, source: s1 === s2 ? s1 : "mixed", fetched };
  } catch (err: any) {
    console.error("[Analytics API] apiFetchActivityExtrasCombined ERROR", err);
    throw new Error("api.common.fetchFailed");
  }
}

/* ========================= LAST ACTIVITY / TODAY BUNDLE ========================= */

/**
 * Tvar zodpovedá presne tomu, čo skladá _build_activity_bundles() na
 * backende (Services/analytics.py).
 *
 * 🔍 POZOR pri `streams`: backend ho berie priamo z db_get_streams_batch,
 * čo je SUROVÝ DB riadok (heartrate_bpm, time_s, ...), NIE prehodené na
 * StreamsData tvar (hr, duration_s...) — to prehodenie sa zjavne deje v
 * Services/activities_streams.py (service_get_streams_cached_or_fetch),
 * ktorý som nevidel. Kým ho nepošleš, nechávam `streams` ako `any`, nech
 * netvrdím zhodu so StreamsData, ktorú som neoveril.
 */
export type ActivityBundle = {
  summary: ActivityRow | null;
  enrichment: ActivityEnrichment | null;
  streams: any | null;
  laps: any[];
  splits: any[];
};

export async function apiGetLastActivityBundle(
  userId: number,
): Promise<ActivityBundle | null> {
  if (!userId) throw new Error("api.activities.missingUserId");
  const path = `/analytics/lastActivity/${encodeURIComponent(String(userId))}`;
  try {
    const json = await callBackend<any>(path, { method: "GET", cache: "no-store" });
    if (!json?.success) return null;
    return (json.data as ActivityBundle) ?? null;
  } catch (err: any) {
    console.error("[Analytics API] apiGetLastActivityBundle ERROR", err);
    throw new Error("api.common.fetchFailed");
  }
}

export async function apiGetTodayActivitiesBundle(
  userId: number,
): Promise<ActivityBundle[]> {
  if (!userId) throw new Error("api.activities.missingUserId");
  const path = `/analytics/todayActivities/${encodeURIComponent(String(userId))}`;
  try {
    const json = await callBackend<any>(path, { method: "GET", cache: "no-store" });
    if (!json?.success) return [];
    return Array.isArray(json.data) ? (json.data as ActivityBundle[]) : [];
  } catch (err: any) {
    console.error("[Analytics API] apiGetTodayActivitiesBundle ERROR", err);
    throw new Error("api.common.fetchFailed");
  }
}

/* ========================= STREAK ========================= */

export type StreakData = {
  current_streak: number;
  best_streak: number;
  this_week_done: number;
  min_sessions_per_week: number;
  min_duration_min: number;
};

export async function apiGetStreak(userId: number): Promise<StreakData | null> {
  if (!userId) throw new Error("api.activities.missingUserId");
  try {
    const json = await callBackend<any>(
      `/analytics/streak/${encodeURIComponent(String(userId))}`,
      { method: "GET", cache: "no-store" },
    );
    return json?.success ? (json.data as StreakData) : null;
  } catch (err: any) {
    console.error("[Analytics API] apiGetStreak ERROR", err);
    return null;
  }
}
