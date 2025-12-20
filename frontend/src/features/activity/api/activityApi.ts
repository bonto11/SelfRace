// src/features/activity/api/activityApi.ts
import { API_URL } from "@/shared/config";
import {
  normalizeActivityRow,
  type ActivityRow,
  type ActivityDetailExtra,
} from "@/features/activity/utils/activity";

/* --------------------- Typy z backendu --------------------- */

export type StreamsData = {
  time_s: number[];
  hr: (number | null)[];
  duration_s: number;
};

/* --------------------- Helpers --------------------- */

function parseJsonSafe(text: string): any {
  try {
    return JSON.parse(text);
  } catch (e) {
    console.warn("[activityApi] JSON parse error, raw:", text.slice(0, 400));
    throw e;
  }
}

/* --------------------- API funkcie --------------------- */

// 1) RANGE
export async function apiFetchRange(
  userId: number,
  start: string,
  end: string
): Promise<ActivityRow[]> {
  const url = `${API_URL}/activities/range/${userId}?start=${start}&end=${end}`;
  console.debug("[activityApi][range] ->", url);

  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  const json = parseJsonSafe(text);

  const list: any[] = Array.isArray(json?.data)
    ? json.data
    : Array.isArray(json?.rows)
    ? json.rows
    : [];

  const norm = (list as any[])
    .map(normalizeActivityRow)
    .filter(Boolean) as ActivityRow[];

  norm.sort((a, b) => a.date.localeCompare(b.date));
  return norm;
}

// 2) DETAIL (laps + splits)
// userId v signatúre – BE ho môže ignorovať, ale FE ho má pripravený
export async function apiFetchDetail(
  userId: number,
  activityId: number
): Promise<ActivityDetailExtra> {
  const url = `${API_URL}/activities/detail/${userId}/${activityId}`;

  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => ({}));

  return {
    laps: Array.isArray(json?.laps) ? json.laps : [],
    splits: Array.isArray(json?.splits) ? json.splits : [],
  };
}

// 3) STREAMS (HR)
// userId posielame ako query param, BE ho môže začať používať neskôr
export async function apiFetchStreams(
  userId: number,
  activityId: number,
  opts: { fetch?: boolean; max?: number } = {}
): Promise<StreamsData> {
  const q = new URLSearchParams();
  if (opts.fetch) q.set("fetch", "true");
  if (opts.max != null) q.set("max", String(opts.max));
  if (userId != null) q.set("user_id", String(userId));

  const url = `${API_URL}/activities/streams/one/${userId}/${activityId}?${q.toString()}`;

  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => ({}));

  return {
    time_s: Array.isArray(json?.time_s) ? json.time_s : [],
    hr: Array.isArray(json?.hr) ? json.hr : [],
    duration_s: Number(json?.duration_s) || 0,
  };
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
  const q = new URLSearchParams({ days: String(days) });
  if (sportCsv) q.set("sport", sportCsv);

  const url = `${API_URL}/analytics/pareto8020/widget/${userId}?${q.toString()}`;
  console.debug("[activityApi][paretoWidget] ->", url);

  const res = await fetch(url, { cache: "no-store" });
  const js = await res.json().catch(() => ({}));
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
  const q = new URLSearchParams({ weeks: String(weeks) });
  if (sportCsv) q.set("sport", sportCsv);

  const url = `${API_URL}/analytics/pareto8020/${userId}?${q.toString()}`;
  console.debug("[activityApi][paretoTrend] ->", url);

  const res = await fetch(url, { cache: "no-store" });
  const js = await res.json().catch(() => ({}));
  const rws = Array.isArray(js?.data) ? js.data : [];
  return rws;
}