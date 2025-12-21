// src/features/activity/api/activityApi.ts
import { API_URL } from "@/shared/config";
import type { ActivityRow,MiniActivity, SportFE } from "@/features/activities/types/activities";

import {
  normalizeActivityRow,
  parseJsonSafe,
} from "@/features/activities/utils/activity";


// 1) RANGE
export async function apiFetchRange(
  userId: number,
  start: string,
  end: string
): Promise<ActivityRow[]> {
  const url = `${API_URL}/activities_summary/range/${userId}?start=${start}&end=${end}`;
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

export async function apiFetchActivitiesAround(
  userId: number,
  opts: {
    date: string;             // "YYYY-MM-DD"
    deltaDays?: number;       // default 1  ->  +/- 1 deň
    sports?: SportFE[];       // default ["run","mixed"]
  }
): Promise<MiniActivity[]> {
  const delta = opts.deltaDays ?? 1;
  const sports = (opts.sports ?? ["run","mixed"]).join(",");
  const url = `${API_URL}/activities_summary/select/${userId}` +
              `?date=${encodeURIComponent(opts.date)}&delta_days=${delta}&sports=${encodeURIComponent(sports)}`;

  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`fetchActivitiesAround failed: ${r.status}`);
  const j = await r.json().catch(() => ({}));
  return (j?.items ?? []) as MiniActivity[];
}