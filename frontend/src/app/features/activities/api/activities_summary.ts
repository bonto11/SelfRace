// src/features/activity/api/activities_summary.ts
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
  const path = `/activities_summary/range/${userId}?start=${encodeURIComponent(
    start
  )}&end=${encodeURIComponent(end)}`;

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
}

export async function apiFetchActivitiesAround(
  userId: number,
  opts: {
    date: string; // "YYYY-MM-DD"
    deltaDays?: number; // default 1  ->  +/- 1 deň
    sports?: SportFE[]; // default ["run","mixed"]
  }
): Promise<MiniActivity[]> {
  const delta = opts.deltaDays ?? 1;
  const sports = (opts.sports ?? ["run", "mixed"]).join(",");

  const path =
    `/activities_summary/select/${userId}` +
    `?date=${encodeURIComponent(opts.date)}` +
    `&delta_days=${delta}` +
    `&sports=${encodeURIComponent(sports)}`;

  const j = await callBackend<{ items?: MiniActivity[] }>(path, {
    method: "GET",
    cache: "no-store",
  });

  return (j?.items ?? []) as MiniActivity[];
}