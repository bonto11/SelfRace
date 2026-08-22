// src/features/coach/api/coach_plan_active.ts
import { callBackend } from "@/app/shared/utils/callBackend";

/* ========================= TYPES ========================= */

export type SaveActivePlanResult = {
  success: boolean;
  plan_start?: string;
  plan_end?: string;
  horizon_days?: number;
  meta?: any;
  detail?: string | null;
  error?: string | null;
};

export type CancelActivePlanResult = {
  success: boolean;
  deleted: number;
  detail?: string | null;
  error?: string | null;
};

export type ExtendActivePlanResult = {
  success: boolean;
  extended_days: number;
  plan_start: string;
  plan_end: string;
  horizon_days: number;
  note?: string;
  detail?: string | null;
  error?: string | null;
};

export type ReorderUpdate = {
  id: number;
  plan_date: string;
  session_index: number;
};

export type ActivePlanStatus = {
  success: boolean;
  has_active: boolean;
  has_weekly_data?: boolean;
  has_daily_data?: boolean;
  meta?: any;
  detail?: string | null;
  error?: string | null;
};



type SimpleSuccess = {
  success: boolean;
  detail?: string | null;
  error?: string | null;
};

/* ========================= SAVE ACTIVE PLAN ========================= */
export async function apiActivePlanSave(
  userId: number,
  payload: any
): Promise<SaveActivePlanResult> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/coach-plan-active/${encodeURIComponent(String(userId))}/save`;

  try {
    const json = await callBackend<SaveActivePlanResult>(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
    });

    if (!json?.success) throw new Error("api.coach.planSaveFailed");
    return json;
  } catch (e: any) {
    console.error("[Coach][apiActivePlanSave] ERROR", e);
    throw new Error("api.coach.planSaveFailed");
  }
}

/* ========================= CANCEL ACTIVE PLAN ========================= */
export async function apiActivePlanCancel(
  userId: number,
  planId?: string | null
): Promise<CancelActivePlanResult> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/coach-plan-active/${encodeURIComponent(String(userId))}/cancel`;

  try {
    const json = await callBackend<CancelActivePlanResult>(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(null),
    });

    if (!json?.success) throw new Error("api.coach.planCancelFailed");
    return json;
  } catch (e: any) {
    console.error("[Coach][apiActivePlanCancel] ERROR", e);
    throw new Error("api.coach.planCancelFailed");
  }
}

/* ========================= REORDER DAILY ========================= */
export async function apiActivePlanReorder(
  userId: number,
  updates: ReorderUpdate[]
): Promise<{ success: boolean }> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/coach-plan-active/${encodeURIComponent(String(userId))}/reorder`;

  try {
    const json = await callBackend<SimpleSuccess>(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ updates }),
    });

    if (!json?.success) throw new Error("api.coach.planReorderFailed");
    return { success: true };
  } catch (e: any) {
    console.error("[Coach][apiActivePlanReorder] ERROR", e);
    throw new Error("api.coach.planReorderFailed");
  }
}

/* ========================= LINK ACTIVITY ========================= */
export async function apiActivePlanLinkActivity(
  userId: number,
  sessionId: number,
  activityId: number | null
): Promise<{ success: boolean }> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/coach-plan-active/${encodeURIComponent(String(userId))}/link`;

  try {
    const json = await callBackend<SimpleSuccess>(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        id: sessionId,
        activity_id: activityId,
      }),
    });

    if (!json?.success) throw new Error("api.coach.planLinkFailed");
    return { success: true };
  } catch (e: any) {
    console.error("[Coach][apiActivePlanLinkActivity] ERROR", e);
    throw new Error("api.coach.planLinkFailed");
  }
}

/* ========================= STATUS ========================= */
export async function apiActivePlanStatus(
  userId: number
): Promise<ActivePlanStatus> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/coach-plan-active/${encodeURIComponent(String(userId))}/status`;

  try {
    const json = await callBackend<ActivePlanStatus>(path, {
      method: "GET",
      headers: { "content-type": "application/json" },
      cache: "no-store",
    });

    if (!json?.success) throw new Error("api.coach.planStatusFailed");
    return json;
  } catch (e: any) {
    console.error("[Coach][apiActivePlanStatus] ERROR", e);
    throw new Error("api.coach.planStatusFailed");
  }
}


/* ========================= GET HISTORY ========================= */
export async function apiGetCoachPlanHistory(userId: number | string): Promise<any[]> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/coach-plan-active/${encodeURIComponent(String(userId))}/history`;

  try {
    const json = await callBackend<any[]>(path, {
      method: "GET",
      headers: { "content-type": "application/json" },
      cache: "no-store",
    });

    if (!Array.isArray(json)) throw new Error("api.coach.planHistoryFailed");
    return json;
  } catch (e: any) {
    console.error("[Coach][apiGetCoachPlanHistory] ERROR", e);
    throw new Error("api.coach.planHistoryFailed");
  }
}

/* ========================= TYPES ========================= */
export type PlanSummaryHardStats = {
  weeks_tracked: number;
  compliance: {
    done: number;
    missed: number;
    postponed: number;
    planned_remaining: number;
    completion_pct: number | null;
  };
  planned_totals: Record<string, number>;
  actual_totals: Record<string, number>;
  weekly_averages: Record<string, number>;
  avg_session_duration_min: number | null;
};

 
export type PlanSummaryRecord = {
  id: number;
  user_id: number;
  plan_meta_id: number;
  activity_id: number | null;

  race_name: string | null;
  race_date: string | null;
  race_target_time: string | null;
  race_actual_time_s: number | null;
  race_target_distance_km: number | null;
  race_actual_distance_km: number | null;

  weeks_tracked: number | null;
  planned_stats: Record<string, number> | null;
  actual_stats: Record<string, number> | null;

  ai_headline: string | null;
  ai_summary_text: string | null;
  raw_ai_json: {
    headline?: string;
    summary_text?: string;
    achieved_target?: boolean | null;
    highlights?: string[];
    areas_to_improve?: string[];
    next_cycle_advice?: string;
  } | null;

  trigger_type: "race_match" | "last_session_match" | "manual";
  is_plan_completed: boolean;

  created_at: string;
  hard_stats: PlanSummaryHardStats | null;
};

type ListPlanSummariesResult = {
  success: boolean;
  items?: PlanSummaryRecord[];
  detail?: string | null;
  error?: string | null;
};

type LatestPlanSummaryResult = {
  success: boolean;
  item?: PlanSummaryRecord | null;
  detail?: string | null;
  error?: string | null;
};

type MilestoneSummaryResult = {
  ok: boolean;
  reason?: string;
  data?: PlanSummaryRecord;
};

/* ========================= LIST ========================= */
export async function apiListPlanSummaries(
  userId: number,
): Promise<PlanSummaryRecord[]> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/coach-plan-active/plan-summaries/${encodeURIComponent(String(userId))}`;

  try {
    const json = await callBackend<ListPlanSummariesResult>(path, {
      method: "GET",
      headers: { "content-type": "application/json" },
      cache: "no-store",
    });

    if (!json?.success) throw new Error("api.coach.planSummaryListFailed");
    return json.items ?? [];
  } catch (e: any) {
    console.error("[Coach][apiListPlanSummaries] ERROR", e);
    throw new Error("api.coach.planSummaryListFailed");
  }
}

/* ========================= LATEST ========================= */
export async function apiGetLatestPlanSummary(
  userId: number,
): Promise<PlanSummaryRecord | null> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/coach-plan-active/plan-summaries/${encodeURIComponent(String(userId))}/latest`;

  try {
    const json = await callBackend<LatestPlanSummaryResult>(path, {
      method: "GET",
      headers: { "content-type": "application/json" },
      cache: "no-store",
    });

    if (!json?.success) throw new Error("api.coach.planSummaryLatestFailed");
    return json.item ?? null;
  } catch (e: any) {
    console.error("[Coach][apiGetLatestPlanSummary] ERROR", e);
    throw new Error("api.coach.planSummaryLatestFailed");
  }
}

/* ========================= GENERATE (manuálny milestone) ========================= */
export async function apiGenerateMilestoneSummary(
  userId: number,
): Promise<MilestoneSummaryResult> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/coach-plan-active/milestone-summary/${encodeURIComponent(String(userId))}`;

  try {
    const json = await callBackend<MilestoneSummaryResult>(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
    });

    return json;
  } catch (e: any) {
    console.error("[Coach][apiGenerateMilestoneSummary] ERROR", e);
    throw new Error("api.coach.milestoneSummaryFailed");
  }
}
