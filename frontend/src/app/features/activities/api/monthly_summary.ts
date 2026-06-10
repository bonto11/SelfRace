// src/features/coach/api/monthly_summary.ts
import { callBackend } from "@/app/shared/utils/callBackend";

/* ─── TYPY ─── */
export type SportStat = {
  count: number;
  total_time_s: number;
  avg_time_s: number;
  longest_s: number;
  total_dist_m: number | null;
  avg_speed_mps: number | null;
};

export type ZoneMinutes = {
  z1?: number; z2?: number; z3?: number; z4?: number; z5?: number;
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

export type MonthlyReview = {
  schema_version: number;
  period: { year: number; month: number };
  model: string;
  review_text: string;
  highlights: string[];
  concerns: string[];
  recovery_note?: string;
  zone_note?: string;
  next_month_focus?: string;
};

/* ─── HELPERS ─── */
function _ym(year?: number, month?: number): string {
  const params = new URLSearchParams();
  if (year)  params.set("year",  String(year));
  if (month) params.set("month", String(month));
  return params.toString() ? `?${params.toString()}` : "";
}

/* ─── API ─── */
export async function apiGetMonthlySummary(
  userId: number,
  year?: number,
  month?: number,
): Promise<MonthlySummary | null> {
  if (!userId) throw new Error("api.common.missingUserAuth");
  try {
    const json = await callBackend<any>(
      `/monthly-summary/${encodeURIComponent(String(userId))}${_ym(year, month)}`,
      { method: "GET", cache: "no-store" },
    );
    return json?.success ? (json.data as MonthlySummary) : null;
  } catch (err) {
    console.error("[MonthlySummary] GET ERROR:", err);
    return null;
  }
}

export async function apiGetMonthlyReview(
  userId: number,
  year?: number,
  month?: number,
): Promise<MonthlyReview | null> {
  if (!userId) throw new Error("api.common.missingUserAuth");
  try {
    const json = await callBackend<any>(
      `/monthly-summary/${encodeURIComponent(String(userId))}/review${_ym(year, month)}`,
      { method: "GET", cache: "no-store" },
    );
    return json?.success ? (json.data as MonthlyReview | null) : null;
  } catch (err) {
    console.error("[MonthlySummary] GET review ERROR:", err);
    return null;
  }
}

export async function apiGenerateMonthlyReview(
  userId: number,
  year?: number,
  month?: number,
): Promise<MonthlyReview | null> {
  if (!userId) throw new Error("api.common.missingUserAuth");
  try {
    const json = await callBackend<any>(
      `/monthly-summary/${encodeURIComponent(String(userId))}/review${_ym(year, month)}`,
      { method: "POST", cache: "no-store" },
    );
    if (!json?.success) {
      console.warn("[MonthlySummary] generate failed:", json);
      return null;
    }
    return json.data as MonthlyReview;
  } catch (err) {
    console.error("[MonthlySummary] POST review ERROR:", err);
    return null;
  }
}