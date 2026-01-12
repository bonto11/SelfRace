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
    return {
      time_s: [],
      hr: [],
      duration_s: 0,
      cadence_rpm: [],
      power_w: [],
      distance_m: [],
      altitude_m: [],
    };
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
    // BE: { success: true, streams: { ... } }
    const json = await callBackend<any>(path, {
      method: "GET",
      cache: "no-store",
    });

    const payload = json?.streams ?? json ?? {};

    // time
    const time_s: number[] = Array.isArray(payload.time_s)
      ? payload.time_s
      : Array.isArray(payload.time)
      ? payload.time
      : [];

    // HR
    const hr: (number | null)[] = Array.isArray(payload.hr)
      ? payload.hr
      : Array.isArray(payload.heartrate_bpm)
      ? payload.heartrate_bpm
      : [];

    // cadence
    const cadence_rpm: (number | null)[] | undefined = Array.isArray(
      payload.cadence_rpm
    )
      ? payload.cadence_rpm
      : Array.isArray(payload.cadence)
      ? payload.cadence
      : undefined;

    // power
    const power_w: (number | null)[] | undefined = Array.isArray(payload.power_w)
      ? payload.power_w
      : Array.isArray(payload.watts)
      ? payload.watts
      : undefined;

    // distance
    const distance_m: (number | null)[] | undefined = Array.isArray(
      payload.distance_m
    )
      ? payload.distance_m
      : Array.isArray(payload.distance)
      ? payload.distance
      : undefined;

    // altitude / prevýšenie
    const altitude_m: (number | null)[] | undefined = Array.isArray(
      payload.altitude_m
    )
      ? payload.altitude_m
      : Array.isArray(payload.altitude)
      ? payload.altitude
      : undefined;

    const duration_s: number =
      typeof payload.duration_s === "number"
        ? payload.duration_s
        : time_s.length
        ? Number(time_s[time_s.length - 1]) || 0
        : 0;

    return {
      time_s,
      hr,
      duration_s,
      cadence_rpm: cadence_rpm ?? [],
      power_w: power_w ?? [],
      distance_m: distance_m ?? [],
      altitude_m: altitude_m ?? [],
    };
  } catch (e) {
    console.error("[apiFetchStreams] error", e);
    return {
      time_s: [],
      hr: [],
      duration_s: 0,
      cadence_rpm: [],
      power_w: [],
      distance_m: [],
      altitude_m: [],
    };
  }
}