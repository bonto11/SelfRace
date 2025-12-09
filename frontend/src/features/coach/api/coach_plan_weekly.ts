// src/features/coach/api/coach_plan_weekly.ts
import { API_URL } from "@/shared/config";
import { robustJson } from "@/features/coach/api/_api_utils";

export type WeeklyPlanGenerateOptions = {
  overwrite?: boolean;
  state_id?: number | null; // id z coach_athlete_state
  weeks?: number | null;    // koľko týždňov
};

/**
 * POST /coach-plan-weekly/generate/{user_id}
 */
export async function apiGenerateWeeklyPlan(
  userId: number,
  opts: WeeklyPlanGenerateOptions = {}
): Promise<any> {
  if (!API_URL) throw new Error("API_URL is not configured");

  const payload = {
    overwrite: opts.overwrite ?? true,
    state_id: opts.state_id ?? null,
    weeks: opts.weeks ?? null,
  };

  const res = await fetch(`${API_URL}/coach-plan-weekly/generate/${userId}`, {
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

/* ---------- typy + GET latest ---------- */

export type WeeklyPlanWeek = {
  week_index: number;
  week_start: string | null;
  week_end: string | null;
  goal?: string | null;
  focus?: string | null;
  load_phase?: string | null;
  planned_km?: number | null;
  planned_minutes?: number | null;
  completed_km?: number | null;
  completed_minutes?: number | null;
  notes?: string | null;
  raw_json?: any;
};

export type WeeklyPlanLatest = {
  plan_id: string;
  weeks: WeeklyPlanWeek[];
};

type WeeklyPlanLatestResponse = {
  success: boolean;
  plan: WeeklyPlanLatest | null;
};

/**
 * GET /coach-plan-weekly/latest/{user_id}
 */
export async function apiGetLatestWeeklyPlan(
  userId: number
): Promise<WeeklyPlanLatest | null> {
  if (!API_URL) throw new Error("API_URL is not configured");

  const res = await fetch(`${API_URL}/coach-plan-weekly/latest/${userId}`, {
    method: "GET",
    headers: { "content-type": "application/json" },
    cache: "no-store",
  }).catch((err) => {
    throw new Error(`Network/CORS: ${String(err)}`);
  });

  const json = (await robustJson(res)) as WeeklyPlanLatestResponse;

  if (!res.ok || json?.success === false) {
    throw new Error(
      (json as any)?.detail || (json as any)?.error || `HTTP ${res.status}`
    );
  }

  return json.plan ?? null;
}