// src/features/activity/api/activityApi.ts
import { API_URL } from "@/shared/config";
import {
  normalizeActivityRow,
  parseJsonSafe
} from "@/features/activity/utils/activity";

import {
  StreamsData,
  ActivityRow,
} from "@/features/activity/types/activities";

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