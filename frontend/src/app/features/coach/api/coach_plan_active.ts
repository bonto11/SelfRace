// src/features/coach/api/coach_plan_active.ts
import { callBackend } from "@/app/shared/utils/callBackend";

/* ========================= TYPES ========================= */

export type SaveActivePlanResult = {
  success: boolean;
  plan_id: string | null;
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
  plan_id: string | null;
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
/**
 * POST /coach-plan-active/{user_id}/save
 */
export async function apiActivePlanSave(
  userId: number,
  payload: any
): Promise<SaveActivePlanResult> {
  if (!userId) throw new Error("Missing userId in apiActivePlanSave");

  const path = `/coach-plan-active/${encodeURIComponent(
    String(userId)
  )}/save`;

  let json: SaveActivePlanResult;
  try {
    json = await callBackend<SaveActivePlanResult>(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
    });
  } catch (e: any) {
    console.error("[Coach][apiActivePlanSave] ERROR", e);
    throw e instanceof Error
      ? e
      : new Error(`Network/BE error (active plan save): ${String(e)}`);
  }

  if (!json?.success) {
    throw new Error(
      json.detail || json.error || "Failed to save active plan"
    );
  }

  return json;
}

/* ========================= CANCEL ACTIVE PLAN ========================= */
/**
 * POST /coach-plan-active/{user_id}/cancel
 */
export async function apiActivePlanCancel(
  userId: number,
  planId?: string | null
): Promise<CancelActivePlanResult> {
  if (!userId) throw new Error("Missing userId in apiActivePlanCancel");

  const path = `/coach-plan-active/${encodeURIComponent(
    String(userId)
  )}/cancel`;

  let json: CancelActivePlanResult;
  try {
    json = await callBackend<CancelActivePlanResult>(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ plan_id: planId ?? null }),
    });
  } catch (e: any) {
    console.error("[Coach][apiActivePlanCancel] ERROR", e);
    throw e instanceof Error
      ? e
      : new Error(`Network/BE error (active plan cancel): ${String(e)}`);
  }

  if (!json?.success) {
    throw new Error(
      json.detail || json.error || "Failed to cancel active plan"
    );
  }

  return json;
}

/* ========================= CONTINUE ACTIVE PLAN ========================= */
/**
 * PATCH /coach-plan-active/{user_id}/continue
 */
export async function apiActivePlanContinue(
  userId: number,
  minHorizonDays = 10
): Promise<ExtendActivePlanResult> {
  if (!userId) throw new Error("Missing userId in apiActivePlanContinue");

  const path = `/coach-plan-active/${encodeURIComponent(
    String(userId)
  )}/continue`;

  let json: ExtendActivePlanResult;
  try {
    json = await callBackend<ExtendActivePlanResult>(path, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ min_horizon_days: minHorizonDays }),
    });
  } catch (e: any) {
    console.error("[Coach][apiActivePlanContinue] ERROR", e);
    throw e instanceof Error
      ? e
      : new Error(`Network/BE error (active plan continue): ${String(e)}`);
  }

  if (!json?.success) {
    throw new Error(
      json.detail || json.error || "Failed to continue active plan"
    );
  }

  return json;
}

/* ========================= EXTEND ACTIVE PLAN ========================= */
/**
 * POST /coach-plan-active/{user_id}/extend?min_horizon_days=...
 */
export async function apiActivePlanExtend(
  userId: number,
  minHorizonDays = 10
): Promise<ExtendActivePlanResult> {
  if (!userId) throw new Error("Missing userId in apiActivePlanExtend");

  const path = `/coach-plan-active/${encodeURIComponent(
    String(userId)
  )}/extend?min_horizon_days=${encodeURIComponent(
    String(minHorizonDays)
  )}`;

  let json: ExtendActivePlanResult;
  try {
    json = await callBackend<ExtendActivePlanResult>(path, {
      method: "POST",
      cache: "no-store",
    });
  } catch (e: any) {
    console.error("[Coach][apiActivePlanExtend] ERROR", e);
    throw e instanceof Error
      ? e
      : new Error(`Network/BE error (active plan extend): ${String(e)}`);
  }

  if (!json?.success) {
    throw new Error(
      json.detail || json.error || "Failed to extend active plan"
    );
  }

  return json;
}

/* ========================= REORDER DAILY ========================= */
/**
 * POST /coach-plan-active/{user_id}/reorder
 */
export async function apiActivePlanReorder(
  userId: number,
  updates: ReorderUpdate[]
): Promise<{ success: boolean }> {
  if (!userId) throw new Error("Missing userId in apiActivePlanReorder");

  const path = `/coach-plan-active/${encodeURIComponent(
    String(userId)
  )}/reorder`;

  let json: SimpleSuccess;
  try {
    json = await callBackend<SimpleSuccess>(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ updates }),
    });
  } catch (e: any) {
    console.error("[Coach][apiActivePlanReorder] ERROR", e);
    throw e instanceof Error
      ? e
      : new Error(`Network/BE error (active plan reorder): ${String(e)}`);
  }

  return { success: !!json?.success };
}

/* ========================= LINK ACTIVITY ========================= */
/**
 * POST /coach-plan-active/{user_id}/link
 */
export async function apiActivePlanLinkActivity(
  userId: number,
  sessionId: number,
  activityId: number | null
): Promise<{ success: boolean }> {
  if (!userId) throw new Error("Missing userId in apiActivePlanLinkActivity");

  const path = `/coach-plan-active/${encodeURIComponent(
    String(userId)
  )}/link`;

  let json: SimpleSuccess;
  try {
    json = await callBackend<SimpleSuccess>(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        session_id: sessionId,
        activity_id: activityId,
      }),
    });
  } catch (e: any) {
    console.error("[Coach][apiActivePlanLinkActivity] ERROR", e);
    throw e instanceof Error
      ? e
      : new Error(`Network/BE error (active plan link): ${String(e)}`);
  }

  return { success: !!json?.success };
}

/* ========================= STATUS ========================= */
export async function apiActivePlanStatus(
  userId: number
): Promise<ActivePlanStatus> {
  if (!userId) throw new Error("Missing userId in apiActivePlanStatus");

  const path = `/coach-plan-active/${encodeURIComponent(
    String(userId)
  )}/status`;

  let json: ActivePlanStatus;
  try {
    json = await callBackend<ActivePlanStatus>(path, {
      method: "GET",
      headers: { "content-type": "application/json" },
      cache: "no-store",
    });
  } catch (e: any) {
    console.error("[Coach][apiActivePlanStatus] ERROR", e);
    throw e instanceof Error
      ? e
      : new Error(`Network/BE error (active plan status): ${String(e)}`);
  }

  if (!json?.success) {
    throw new Error(
      json.detail || json.error || "Failed to load active plan status"
    );
  }

  return json;
}