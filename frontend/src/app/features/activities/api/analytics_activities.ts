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
import type { StreamsData } from "@/app/features/activities/types/activities";

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
  opts: WeeklyMonoStrainOptions = {}
): Promise<WeeklyMonoStrainRow[]> {
  if (!userId) return [];

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

  return raw.map((w: any) => ({
    week: w.week ?? w.iso_week ?? w.label ?? "",
    label: (w.label ?? w.week ?? "") as string,
    start: w.start ?? "",
    end: w.end ?? "",
    monotony: w.monotony ?? {},
    strain: w.strain ?? {},
  }));
}

export async function apiGetWeeklyLoad(
  userId: number,
  opts: WeeklyLoadOptions = {}
): Promise<WeeklyLoadRow[]> {
  if (!userId) return [];

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
}

/* ========================= PARETO ========================= */

export async function apiFetchParetoWidget(
  userId: number,
  days: number,
  sportCsv: string | null
): Promise<{ easy_min: number; hard_min: number; total_min: number; days: number } | null> {
  if (!userId) return null;

  const q = new URLSearchParams({ days: String(days) });
  if (sportCsv) q.set("sport", sportCsv);

  const path = `/analytics/pareto8020/widget/${encodeURIComponent(String(userId))}?${q.toString()}`;
  const js = await callBackend<any>(path, { method: "GET", cache: "no-store" });
  return js?.data ?? null;
}

export async function apiFetchParetoTrend(
  userId: number,
  weeks: number,
  sportCsv: string | null
): Promise<Array<{ label: string; easy_min: number; hard_min: number; easy_pct: number; hard_pct: number; start?: string; end?: string }>> {
  if (!userId) return [];

  const q = new URLSearchParams({ weeks: String(weeks) });
  if (sportCsv) q.set("sport", sportCsv);

  const path = `/analytics/pareto8020/${encodeURIComponent(String(userId))}?${q.toString()}`;
  const js = await callBackend<any>(path, { method: "GET", cache: "no-store" });
  return Array.isArray(js?.data) ? js.data : [];
}

/* ========================= NEW: streams + extras ========================= */

export async function apiFetchActivityStreams(
  userId: number,
  activityId: number,
  fetchIfMissing: boolean
): Promise<{ streams: any; source: string; fetched: boolean } | null> {
  if (!userId || !activityId) return null;

  const q = new URLSearchParams();
  if (fetchIfMissing) q.set("fetch", "true");

  const path = `/analytics/activityStreams/${encodeURIComponent(String(userId))}/${encodeURIComponent(
    String(activityId)
  )}${q.toString() ? `?${q}` : ""}`;

  const js = await callBackend<any>(path, { method: "POST", cache: "no-store" });
  if (!js?.success) return null;

  console.log("js", js);
  return {
    streams: js.streams ?? null,
    source: js.source ?? "unknown",
    fetched: !!js.fetched,
  };
}

export async function apiFetchActivityExtras(
  userId: number,
  activityId: number,
  fetchIfMissing: boolean
): Promise<{ laps: any[]; splits: any[]; source: string; fetched: boolean } | null> {
  if (!userId || !activityId) return null;

  const q = new URLSearchParams();
  if (fetchIfMissing) q.set("fetch", "true");

  const path = `/analytics/activityExtras/${encodeURIComponent(String(userId))}/${encodeURIComponent(
    String(activityId)
  )}${q.toString() ? `?${q}` : ""}`;

  const js = await callBackend<any>(path, { method: "POST", cache: "no-store" });
  if (!js?.success) return null;

  return {
    laps: Array.isArray(js?.laps) ? js.laps : [],
    splits: Array.isArray(js?.splits) ? js.splits : [],
    source: js.source ?? "unknown",
    fetched: !!js.fetched,
  };
}

/* ========================= COMBINED helper (FE convenience) ========================= */

export type ActivityExtrasCombined = {
  streams: StreamsData | null;
  laps: any[];
  splits: any[];
  source: string;
  fetched: boolean;
};

export async function apiFetchActivityExtrasCombined(
  userId: number,
  activityId: number,
  fetchIfMissing: boolean
): Promise<ActivityExtrasCombined | null> {
  if (!userId || !activityId) return null;

  const [stRes, exRes] = await Promise.all([
    apiFetchActivityStreams(userId, activityId, fetchIfMissing),
    apiFetchActivityExtras(userId, activityId, fetchIfMissing),
  ]);

  console.log("stRes", stRes);
  const streams = (stRes?.streams ?? null) as StreamsData | null;
  console.log("streams", streams);
  const laps = Array.isArray(exRes?.laps) ? exRes!.laps : [];
  const splits = Array.isArray(exRes?.splits) ? exRes!.splits : [];

  const fetched = !!(stRes?.fetched || exRes?.fetched);
  const s1 = stRes?.source ?? "unknown";
  const s2 = exRes?.source ?? "unknown";
  const source = s1 === s2 ? s1 : "mixed";

  return { streams, laps, splits, source, fetched };
}