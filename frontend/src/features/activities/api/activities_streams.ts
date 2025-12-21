// src/features/activities/api/activities_streams.ts
import { API_URL } from "@/shared/config";
import type { StreamsData } from "@/features/activities/types/activities";

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
  if (!res.ok) {
    console.error("[apiFetchStreams] HTTP error", res.status);
    return { time_s: [], hr: [], duration_s: 0 };
  }

  const json: any = await res.json().catch(() => ({}));

  const payload = json?.streams ?? json ?? {};

  const time_s: number[] = Array.isArray(payload.time_s)
    ? payload.time_s
    : Array.isArray(payload.time)
    ? payload.time
    : [];

  const hr: (number | null)[] = Array.isArray(payload.hr)
    ? payload.hr
    : Array.isArray(payload.heartrate_bpm)
    ? payload.heartrate_bpm
    : [];

  const duration_s: number =
    typeof payload.duration_s === "number"
      ? payload.duration_s
      : time_s.length
      ? Number(time_s[time_s.length - 1]) || 0
      : 0;

  return { time_s, hr, duration_s };
}