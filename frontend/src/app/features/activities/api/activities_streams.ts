// src/features/activities/api/activities_streams.ts
import type { StreamsData } from "@/app/features/activities/types/activities";
import { callBackend } from "@/app/shared/utils/callBackend";

export async function apiFetchStreams(
  userId: number,
  activityId: number,
  opts: { fetch?: boolean; max?: number } = {}
): Promise<StreamsData> {
  if (userId == null || activityId == null) {
    console.error("[apiFetchStreams] missing userId or activityId");
    return { time_s: [], hr: [], duration_s: 0 };
  }

  const q = new URLSearchParams();
  if (opts.fetch) q.set("fetch", "true");
  if (opts.max != null) q.set("max", String(opts.max));

  const path = `/activities_streams/${encodeURIComponent(
    String(userId)
  )}/${encodeURIComponent(String(activityId))}${
    q.toString() ? `?${q.toString()}` : ""
  }`;

  console.debug("[apiFetchStreams] ->", path);

  try {
    const json: any = await callBackend<any>(path, {
      method: "GET",
      cache: "no-store",
    });

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
  } catch (e) {
    console.error("[apiFetchStreams] error", e);
    return { time_s: [], hr: [], duration_s: 0 };
  }
}