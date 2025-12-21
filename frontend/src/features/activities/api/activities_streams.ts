// src/features/activity/api/activityApi.ts
import { API_URL } from "@/shared/config";
import { StreamsData } from "@/features/activities/types/activities";

// 3) STREAMS (HR)
export async function apiFetchStreams(
  userId: number,
  activityId: number,
  opts: { fetch?: boolean; max?: number } = {}
): Promise<StreamsData> {
  const q = new URLSearchParams();
  if (opts.fetch) q.set("fetch", "true");
  if (opts.max != null) q.set("max", String(opts.max));
  if (userId != null) q.set("user_id", String(userId));

  const url = `${API_URL}/activities_streams/${userId}/${activityId}?${q.toString()}`;

  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => ({}));

  return {
    time_s: Array.isArray(json?.time_s) ? json.time_s : [],
    hr: Array.isArray(json?.hr) ? json.hr : [],
    duration_s: Number(json?.duration_s) || 0,
  };
}
