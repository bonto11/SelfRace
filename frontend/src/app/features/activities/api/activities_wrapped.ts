import { callBackend } from "@/app/shared/utils/callBackend";

export type ActivitiesWrappedSport = {
  sport: string;
  count: number;
  total_distance_km: number;
  total_time_min: number;
  total_elevation_m: number;
  avg_pace_s_per_km: number | null;
  avg_speed_kmh: number | null;
  avg_hr_bpm: number | null;
};

export type ActivitiesWrappedHardStats = {
  count: number;
  total_distance_km: number;
  total_time_min: number;
  total_elevation_m: number;
  avg_pace_s_per_km: number | null;
  avg_hr_bpm: number | null;
  by_sport: ActivitiesWrappedSport[];
};

export type ActivitiesWrappedSummary = {
  id: number;
  user_id: number;
  title: string;
  range_start: string;
  range_end: string;
  hard_stats: ActivitiesWrappedHardStats;
  created_at: string;
};

export type ActivitiesWrappedTrigger = {
  id: number;
  reason: "race_window" | "year_end" | "admin_manual";
  trigger_label: string | null;
  trigger_date: string | null;
  expires_at: string;
};

export type ActivitiesWrappedStatus = {
  success: boolean;
  can_generate: boolean;
  active_trigger: ActivitiesWrappedTrigger | null;
  history: ActivitiesWrappedSummary[];
};

export async function apiGetActivitiesWrappedStatus(userId: number): Promise<ActivitiesWrappedStatus> {
  if (!userId) throw new Error("api.common.missingUserAuth");
  const path = `/activities-wrapped/${encodeURIComponent(String(userId))}/status`;
  const json = await callBackend<ActivitiesWrappedStatus>(path, {
    method: "GET",
    headers: { "content-type": "application/json" },
    cache: "no-store",
  });
  if (!json?.success) throw new Error("api.activitiesWrapped.statusFailed");
  return json;
}

export async function apiGenerateActivitiesWrapped(
  userId: number,
  title: string,
  rangeStart: string,
  rangeEnd: string,
): Promise<{ ok: boolean; reason?: string; data?: ActivitiesWrappedSummary }> {
  if (!userId) throw new Error("api.common.missingUserAuth");
  const path = `/activities-wrapped/${encodeURIComponent(String(userId))}/generate`;
  return callBackend(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ title, range_start: rangeStart, range_end: rangeEnd }),
  });
}