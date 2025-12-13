// src/features/coach/api/coach_plan_daily.ts
import { API_URL } from "@/shared/config";
import { robustJson } from "@/features/coach/api/_api_utils";

/* ============ typy ============ */

export type DailyWeekGenerateOptions = {
  week_index: number;      // 1-based index v weekly pláne
  plan_id?: string | null; // ak null → posledný aktívny plán
  overwrite?: boolean;
};

/* ============ GENERATE WEEK (coach-plan-daily) ============ */

/**
 * POST /coach-plan-daily/generate/{user_id}
 * volá service_generate_daily_week
 */
export async function apiGenerateDailyForWeek(
  userId: number,
  opts: DailyWeekGenerateOptions
): Promise<any> {
  if (!API_URL) throw new Error("API_URL is not configured");
  if (!opts || typeof opts.week_index !== "number") {
    throw new Error("week_index is required for apiGenerateDailyForWeek");
  }

  const payload = {
    week_index: opts.week_index,
    plan_id: opts.plan_id ?? null,
    overwrite: opts.overwrite ?? true,
  };

  const res = await fetch(`${API_URL}/coach-plan-daily/generate/${userId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((err) => {
    throw new Error(`Network/CORS: ${String(err)}`);
  });

  const json = await robustJson(res);
  if (!res.ok || json?.success === false) {
    throw new Error(json?.detail || json?.error || `HTTP ${res.status}`);
  }
  return json;
}

/* ============ DAILY OVERVIEW (coach-plan-daily) ============ */

export type DailyPlanSession = {
  sport: string;
  title?: string | null;
  duration_min?: number | null;
  intensity?: string | null;
  zone_text?: string | null;
  notes?: string | null;
  session_type?: string | null;
};

export type DailyPlanDay = {
  date: string; // "YYYY-MM-DD"
  sessions: DailyPlanSession[];
};

export type DailyOverview = {
  horizon_days: number;
  days: DailyPlanDay[];
};

type DailyOverviewResponse = {
  success: boolean;
  overview: DailyOverview | null;
};

/**
 * GET /coach-plan-daily/overview/{user_id}
 */
export async function apiGetDailyOverview(
  userId: number
): Promise<DailyOverview | null> {
  if (!API_URL) throw new Error("API_URL is not configured");

  const res = await fetch(`${API_URL}/coach-plan-daily/overview/${userId}`, {
    method: "GET",
    headers: { "content-type": "application/json" },
    cache: "no-store",
  }).catch((err) => {
    throw new Error(`Network/CORS: ${String(err)}`);
  });

  const json = (await robustJson(res)) as DailyOverviewResponse;

  if (!res.ok || json?.success === false) {
    throw new Error(
      (json as any)?.detail || (json as any)?.error || `HTTP ${res.status}`
    );
  }

  return json.overview ?? null;
}