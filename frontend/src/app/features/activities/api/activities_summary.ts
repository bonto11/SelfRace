// src/app/features/activities/api/activities_summary.ts
import { callBackend } from "@/app/shared/utils/callBackend";
import type {
  ActivityRow,
  MiniActivity,
  SportFE,
} from "@/app/features/activities/types/activities";

import { normalizeActivityRow } from "@/app/features/activities/utils/activity";

// 1) RANGE
export async function apiFetchRange(
  userId: number,
  start: string,
  end: string
): Promise<ActivityRow[]> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/activities_summary/range/${encodeURIComponent(String(userId))}?start=${encodeURIComponent(
    start
  )}&end=${encodeURIComponent(end)}`;

  try {
    const json = await callBackend<any>(path, {
      method: "GET",
      cache: "no-store",
    });

    const raw =
      (Array.isArray(json?.data) && json.data) ||
      (Array.isArray(json?.rows) && json.rows) ||
      (Array.isArray(json?.items) && json.items) ||
      (Array.isArray(json) && json) ||
      [];

    const norm = (raw as any[])
      .map(normalizeActivityRow)
      .filter(Boolean) as ActivityRow[];

    // ak chceš najnovšie hore, prehoď poradie
    norm.sort((a, b) => a.date.localeCompare(b.date));
    return norm;
  } catch (err: any) {
    console.error("[Activities API] apiFetchRange ERROR", err);
    throw new Error("api.common.fetchFailed");
  }
}

export async function apiFetchActivitiesAround(
  userId: number,
  opts: {
    date: string; // "YYYY-MM-DD"
    deltaDays?: number; // default 1  ->  +/- 1 deň
    sports?: SportFE[]; // default ["run","mixed"]
  }
): Promise<MiniActivity[]> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const delta = opts.deltaDays ?? 1;
  const sports = (opts.sports ?? ["run", "mixed"]).join(",");

  const path =
    `/activities_summary/select/${encodeURIComponent(String(userId))}` +
    `?date=${encodeURIComponent(opts.date)}` +
    `&delta_days=${delta}` +
    `&sports=${encodeURIComponent(sports)}`;

  try {
    const j = await callBackend<{ items?: MiniActivity[] }>(path, {
      method: "GET",
      cache: "no-store",
    });

    return (j?.items ?? []) as MiniActivity[];
  } catch (err: any) {
    console.error("[Activities API] apiFetchActivitiesAround ERROR", err);
    throw new Error("api.common.fetchFailed");
  }
}