import { API_URL } from "@/shared/config";

/* ========================= HELPERS ========================= */

async function robustJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await res.json();
  const text = await res.text().catch(() => "");
  return { success: false, detail: text || `HTTP ${res.status}` };
}

/* ========================= TYPES ========================= */

export type SaveActivePlanResult = {
  success: boolean;
  plan_id: string | null;
  plan_start?: string;
  plan_end?: string;
  horizon_days?: number;
  meta?: any;
};

export type CancelActivePlanResult = {
  success: boolean;
  deleted: number;
};

export type ExtendActivePlanResult = {
  success: boolean;
  extended_days: number;
  plan_start: string;
  plan_end: string;
  horizon_days: number;
  note?: string;
};

export type ReorderUpdate = {
  id: number;
  plan_date: string;
  session_index: number;
};

/* ========================= SAVE ACTIVE PLAN ========================= */

export async function apiActivePlanSave(
  userId: number,
  payload: any
): Promise<SaveActivePlanResult> {
  if (!API_URL) throw new Error("Missing API_URL");

  const r = await fetch(`${API_URL}/coach-plan-active/${userId}/save`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((e) => {
    throw new Error(`Network: ${String(e)}`);
  });

  const json = await robustJson(r);
  if (!r.ok || json?.success === false) {
    throw new Error(json?.detail || json?.error || `HTTP ${r.status}`);
  }

  return json as SaveActivePlanResult;
}

/* ========================= CANCEL ACTIVE PLAN ========================= */

export async function apiActivePlanCancel(
  userId: number,
  planId?: string | null
): Promise<CancelActivePlanResult> {
  if (!API_URL) throw new Error("Missing API_URL");

  const r = await fetch(`${API_URL}/coach-plan-active/${userId}/cancel`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ plan_id: planId ?? null }),
  }).catch((e) => {
    throw new Error(`Network: ${String(e)}`);
  });

  const json = await robustJson(r);
  if (!r.ok || json?.success === false) {
    throw new Error(json?.detail || json?.error || `HTTP ${r.status}`);
  }

  return json as CancelActivePlanResult;
}

/* ========================= CONTINUE ACTIVE PLAN ========================= */

export async function apiActivePlanContinue(
  userId: number,
  minHorizonDays = 10
): Promise<ExtendActivePlanResult> {
  if (!API_URL) throw new Error("Missing API_URL");

  const r = await fetch(
    `${API_URL}/coach-plan-active/${userId}/continue`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ min_horizon_days: minHorizonDays }),
    }
  ).catch((e) => {
    throw new Error(`Network: ${String(e)}`);
  });

  const json = await robustJson(r);
  if (!r.ok || json?.success === false) {
    throw new Error(json?.detail || json?.error || `HTTP ${r.status}`);
  }

  return json as ExtendActivePlanResult;
}

/* ========================= EXTEND ACTIVE PLAN ========================= */

export async function apiActivePlanExtend(
  userId: number,
  minHorizonDays = 10
): Promise<ExtendActivePlanResult> {
  if (!API_URL) throw new Error("Missing API_URL");

  const r = await fetch(
    `${API_URL}/coach-plan-active/${userId}/extend?min_horizon_days=${minHorizonDays}`,
    { method: "POST" }
  ).catch((e) => {
    throw new Error(`Network: ${String(e)}`);
  });

  const json = await robustJson(r);
  if (!r.ok || json?.success === false) {
    throw new Error(json?.detail || json?.error || `HTTP ${r.status}`);
  }

  return json as ExtendActivePlanResult;
}

/* ========================= REORDER DAILY ========================= */

export async function apiActivePlanReorder(
  userId: number,
  updates: ReorderUpdate[]
): Promise<{ success: boolean }> {
  if (!API_URL) throw new Error("Missing API_URL");

  const r = await fetch(
    `${API_URL}/coach-plan-active/${userId}/reorder`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ updates }),
    }
  ).catch((e) => {
    throw new Error(`Network: ${String(e)}`);
  });

  const json = await robustJson(r);
  return { success: !!json?.success };
}

/* ========================= LINK ACTIVITY ========================= */

export async function apiActivePlanLinkActivity(
  userId: number,
  sessionId: number,
  activityId: number | null
): Promise<{ success: boolean }> {
  if (!API_URL) throw new Error("Missing API_URL");

  const r = await fetch(
    `${API_URL}/coach-plan-active/${userId}/link`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, activity_id: activityId }),
    }
  ).catch((e) => {
    throw new Error(`Network: ${String(e)}`);
  });

  const json = await robustJson(r);
  return { success: !!json?.success };
}