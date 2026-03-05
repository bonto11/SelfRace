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