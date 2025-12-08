// src/features/coach/api/coach_plan_daily.ts
import { API_URL } from "@/shared/config";

/* ============ typy ============ */

export type SaveResult = {
  success: boolean;
  via: "api" | "local" | "none";
  planId?: string | null;
};

export type ExtendPlanResult = {
  success: boolean;
  extended_days: number;
  plan_start: string;
  plan_end: string;
  horizon_days: number;
  inserted_rows?: number;
  note?: string;
};

export type PlanReorderUpdate = {
  id: number;
  plan_date: string; // "YYYY-MM-DD"
  session_index: number; // 0-based
};

export type DailyWeekGenerateOptions = {
  week_index: number; // 1-based index v weekly pláne
  plan_id?: string | null; // ak null → posledný aktívny plán
  overwrite?: boolean;
};

async function robustJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await res.json();
  const text = await res.text().catch(() => "");
  return { success: false, detail: text || `HTTP ${res.status}` };
}

/* ============ SAVE / CANCEL aktívneho plánu (coach-plan) ============ */

/* ============ LINK / REORDER (coach-plan) ============ */

/**
 * Manuálne prelinkovanie jednej planned session na aktivitu.
 * activityId = null → odmapovanie.
 */
export async function apiSavePlanActivityLink(
  userId: number,
  sessionId: number,
  activityId: number | null
): Promise<{ success: boolean; via: "api" | "none" }> {
  if (!API_URL) {
    console.warn(
      "[coach.plan] savePlanActivityLink – missing API_URL, skipping call",
      { userId, sessionId, activityId }
    );
    return { success: false, via: "none" };
  }

  const payload = {
    session_id: sessionId,
    activity_id: activityId,
  };

  const r = await fetch(`${API_URL}/coach-plan/${userId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((err) => {
    console.error("[coach.plan] savePlanActivityLink fetch error", err);
    return null;
  });

  if (r && r.ok) {
    const j = await r.json().catch(() => ({}));
    console.log("[coach.plan] savePlanActivityLink response", j);
    return { success: true, via: "api" };
  }

  return { success: false, via: "api" };
}


/* ============ NOVÝ GENERÁTOR TÝŽDŇA (coach-plan-daily) ============ */

/**
 * Volá BE service_generate_daily_week
 * POST /coach-plan-daily/generate/{user_id}
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
 * – jednoduchý prehľad najbližších dní
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