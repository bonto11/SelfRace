// src/features/activities/api/activities.ts
import { API_URL } from "@/shared/config";
import { robustJson } from "@/features/coach/api/_api_utils";
import {WeeklyLoadRow,WeeklyLoadApiResponse, WeeklyLoadOptions} from "@/features/activity/types/WeeklyLoad";
export type SyncActivitiesOptions = {
  forceLastDays?: number | null;
  fetchDetails?: boolean;
};

export type SyncActivitiesStats = {
  imported: number;
  updated: number;
  skipped: number;
  fetched: number;
};

type SyncActivitiesResponse = {
  success: boolean;
  stats: SyncActivitiesStats;
  note?: string | null;
};

export async function apiSyncActivities(
  userId: number,
  opts: SyncActivitiesOptions = {}
): Promise<SyncActivitiesStats> {
  if (!API_URL) throw new Error("Missing API_URL for apiSyncActivities");

  const body = {
    force_last_days: opts.forceLastDays ?? 30,
    fetch_details: opts.fetchDetails ?? true,
  };

  const res = await fetch(`${API_URL}/activities/sync/${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(body),
  }).catch((e) => {
    throw new Error(`Network/CORS: ${String(e)}`);
  });

  const json = (await robustJson(res)) as SyncActivitiesResponse;

  if (!res.ok || !json?.success) {
    const msg =
      (json as any)?.detail ||
      (json as any)?.error ||
      json?.note ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return json.stats;
}

/* ───────────────────────── Weekly Monotony & Strain ───────────────────────── */

export type WeeklyMonoStrainRow = {
  week: string;
  label: string;
  start: string;
  end: string;
  monotony: { km?: number; time?: number; trimp?: number };
  strain: { km?: number; time?: number; trimp?: number };
};

type WeeklyMonoStrainApiResponse = {
  success?: boolean;
  weeks?: any[];
  data?: any[];
};

export type WeeklyMonoStrainOptions = {
  weeks?: number;
  sport?: string;
};

/**
 * GET /analytics/weekly/{user_id}?weeks=&sport=
 * Normalizuje odpoveď na WeeklyMonoStrainRow[]
 */
export async function apiGetWeeklyMonoStrain(
  userId: number,
  opts: WeeklyMonoStrainOptions = {}
): Promise<WeeklyMonoStrainRow[]> {
  if (!API_URL) {
    throw new Error("Missing API_URL for apiGetWeeklyMonoStrain");
  }

  const params = new URLSearchParams();
  if (opts.weeks != null) params.set("weeks", String(opts.weeks));
  if (opts.sport) params.set("sport", opts.sport);

  const url = `${API_URL}/analytics/weekly/${userId}${
    params.toString() ? `?${params.toString()}` : ""
  }`;

  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  }).catch((e) => {
    throw new Error(`Network/CORS: ${String(e)}`);
  });

  const json = (await robustJson(res)) as WeeklyMonoStrainApiResponse;

  if (!res.ok) {
    const msg =
      (json as any)?.detail ||
      (json as any)?.error ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }

  const raw: any[] = Array.isArray(json?.weeks)
    ? json.weeks
    : Array.isArray(json?.data)
    ? json.data
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

/* ───────────────────────── Weekly Load (km / time / TRIMP) ───────────────────────── */

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
  if (!API_URL) {
    throw new Error("Missing API_URL for apiGetWeeklyLoad");
  }

  const params = new URLSearchParams();
  if (opts.weeks != null) params.set("weeks", String(opts.weeks));
  if (opts.sport) params.set("sport", opts.sport);

  const url = `${API_URL}/analytics/weekly/${userId}${
    params.toString() ? `?${params.toString()}` : ""
  }`;

  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  }).catch((e) => {
    throw new Error(`Network/CORS: ${String(e)}`);
  });

  const json = (await robustJson(res)) as WeeklyLoadApiResponse;

  if (!res.ok) {
    const msg =
      (json as any)?.detail ||
      (json as any)?.error ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }

  const raw: any[] = Array.isArray(json?.weeks)
    ? json.weeks
    : Array.isArray(json?.data)
    ? json.data
    : [];

  return raw.map((w) => ({
    week: w.week ?? w.iso_week ?? w.label ?? "",
    label:
      wlRangeLabel(w.start, w.end) ||
      (w.label ?? w.week ?? ""),
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