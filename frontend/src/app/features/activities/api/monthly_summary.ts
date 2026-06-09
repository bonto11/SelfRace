import { callBackend } from "@/app/shared/utils/callBackend";

export type SportStat = {
  count: number;
  total_time_s: number;
  avg_time_s: number;
  longest_s: number;
  total_dist_m: number | null;
  avg_speed_mps: number | null;
};

export type ZoneMinutes = {
  z1?: number;
  z2?: number;
  z3?: number;
  z4?: number;
  z5?: number;
};

export type RecoveryStats = {
  days_recorded: number;
  avg_hrv_ms?: number | null;
  avg_rhr_bpm?: number | null;
  avg_sleep_duration_min?: number | null;
  avg_sleep_start?: string | null;
};

export type MonthlySummary = {
  period: { year: number; month: number; from: string; to: string };
  summary: { total_sessions: number; total_time_s: number; total_dist_m: number };
  sport_stats: Record<string, SportStat>;
  zones_min: ZoneMinutes;
  recovery: RecoveryStats;
};

export async function apiGetMonthlySummary(
  userId: number,
  year?: number,
  month?: number,
): Promise<MonthlySummary | null> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const params = new URLSearchParams();
  if (year)  params.set("year",  String(year));
  if (month) params.set("month", String(month));

  const path = `/monthly-summary/${encodeURIComponent(String(userId))}${
    params.toString() ? `?${params.toString()}` : ""
  }`;

  console.log("[MonthlySummary] path:", path);

  try {
    const json = await callBackend<any>(path, { method: "GET", cache: "no-store" });
    console.log("[MonthlySummary] raw response:", JSON.stringify(json));

    if (!json?.success) {
      console.warn("[MonthlySummary] success=false, json:", json);
      return null;
    }

    const data = json.data as MonthlySummary;
    console.log("[MonthlySummary] summary:", data?.summary);
    console.log("[MonthlySummary] sport_stats keys:", Object.keys(data?.sport_stats ?? {}));
    return data;
  } catch (err: any) {
    console.error("[MonthlySummary] ERROR:", err);
    return null;
  }
}