// src/features/coach/api/plan.ts
import { API_URL } from "@/shared/config";

type SaveResult = {
  success: boolean;
  via: "api" | "local" | "none";
  planId?: string | null;
};

export async function apiSaveActivePlan(
  userId: number,
  analysis: any,
  meta?: any
): Promise<SaveResult> {
  // vyber weekly časť z analysis – podporujeme viac názvov a tvarov
  const weekly = (() => {
    if (!analysis) return null;

    if (Array.isArray(analysis.weekly)) return analysis.weekly;
    if (Array.isArray(analysis.weekly_weeks)) return analysis.weekly_weeks;
    if (Array.isArray(analysis.weeks_overview)) return analysis.weeks_overview;

    // fallback – niektoré verzie to môžu mať uložené v meta
    if (Array.isArray(analysis.meta?.weeks_overview)) {
      return analysis.meta.weeks_overview;
    }

    return null;
  })();

  const payload = {
    next_10_days: analysis?.next_10_days ?? [],

    // pre BE:
    weekly,                 // používaš payload.get("weekly")
    weeks_overview: weekly, // a zároveň payload.get("weeks_overview")

    meta: meta ?? null,
    overwrite: true,
  };

  console.log("[coach.plan] saveActivePlan → payload", payload);

  // ak nemáme API_URL, ulož čisto lokálne
  if (!API_URL) {
    try {
      localStorage.setItem(
        "coach.active",
        JSON.stringify({ analysis, meta, plan_id: null })
      );
      return { success: true, via: "local", planId: null };
    } catch {
      return { success: false, via: "none", planId: null };
    }
  }

  const r = await fetch(`${API_URL}/coach-plan/${userId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((err) => {
    console.error("[coach.plan] saveActivePlan fetch error", err);
    return null;
  });

  if (r && r.ok) {
    const j = await r.json().catch(() => ({}));
    console.log("[coach.plan] saveActivePlan response", j);
    const planId = j?.plan_id ?? null;

    try {
      localStorage.setItem(
        "coach.active",
        JSON.stringify({ analysis, meta, plan_id: planId })
      );
    } catch {
      // ignore
    }

    return { success: true, via: "api", planId };
  }

  // fallback → localStorage
  try {
    localStorage.setItem(
      "coach.active",
      JSON.stringify({ analysis, meta, plan_id: null })
    );
    return { success: true, via: "local", planId: null };
  } catch {
    return { success: false, via: "none", planId: null };
  }
}

export async function apiCancelActivePlan(
  userId: number,
  planId?: string | null
): Promise<{
  success: boolean;
  via: "api" | "local" | "none";
  deleted?: number;
}> {
  console.log("[coach.plan] cancelActivePlan called", { userId, planId });

  if (!API_URL) {
    try {
      localStorage.removeItem("coach.active");
      return { success: true, via: "local", deleted: 0 };
    } catch {
      return { success: false, via: "none" };
    }
  }

  const r = await fetch(`${API_URL}/coach-plan/${userId}`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ plan_id: planId ?? null }),
  }).catch((err) => {
    console.error("[coach.plan] cancelActivePlan fetch error", err);
    return null;
  });

  if (r && r.ok) {
    const j = await r.json().catch(() => ({}));
    console.log("[coach.plan] cancelActivePlan response", j);
    try {
      localStorage.removeItem("coach.active");
    } catch {
      // ignore
    }
    return { success: true, via: "api", deleted: j?.deleted ?? 0 };
  }

  // fallback – aspoň zmaž lokálne
  try {
    localStorage.removeItem("coach.active");
    return { success: true, via: "local" };
  } catch {
    return { success: false, via: "none" };
  }
}

// --- CONTINUE / UPDATE ACTIVE PLAN ---------------------------------
export async function apiContinuePlan(
  userId: number,
  minHorizonDays = 10
): Promise<ExtendPlanResult> {
  if (!API_URL) {
    console.warn("[coach.plan] continueActivePlan – missing API_URL");
    return {
      success: false,
      extended_days: 0,
      plan_start: "",
      plan_end: "",
      horizon_days: 0,
      note: "missing_api_url",
    };
  }

  const r = await fetch(`${API_URL}/coach-plan/${userId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "continue",
      min_horizon_days: minHorizonDays,
    }),
  }).catch((err) => {
    console.error("[coach.plan] continueActivePlan fetch error", err);
    return null;
  });

  if (r && r.ok) {
    const j = await r.json().catch(() => ({}));
    // BE vráti { success: True, ... } – typovo to sedí na ExtendPlanResult
    return j as ExtendPlanResult;
  }

  return {
    success: false,
    extended_days: 0,
    plan_start: "",
    plan_end: "",
    horizon_days: 0,
    note: "http_error",
  };
}

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
    activity_id: activityId, // null = unlink
  };

  const r = await fetch(`${API_URL}/coach-plan/${userId}/link`, {
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

// --- BATCH REORDER / PRESUN PLÁNU (drag & drop board) -------------------
export type PlanReorderUpdate = {
  id: number;
  plan_date: string; // "YYYY-MM-DD" – nový deň
  session_index: number; // nové poradie v danom dni (0-based)
};

/**
 * Uloží zmeny v pláne (presuny medzi dňami + nové poradie).
 * - BE endpoint: POST /coach-plan/{user_id}/reorder
 * - updates: len zmenené riadky (id + nový plan_date + session_index)
 */
export async function apiSavePlanReorder(
  userId: number,
  updates: Array<{ id: number; plan_date: string; session_index: number }>
): Promise<{ success: boolean }> {
  if (!API_URL) {
    console.warn("[coach.plan] savePlanReorder – missing API_URL", {
      userId,
      updates,
    });
    return { success: false };
  }

  const r = await fetch(`${API_URL}/coach-plan/${userId}/reorder`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ updates }),
  }).catch((err) => {
    console.error("[coach.plan] savePlanReorder fetch error", err);
    return null;
  });

  if (r && r.ok) {
    const j = await r.json().catch(() => ({}));
    console.log("[coach.plan] savePlanReorder response", j);
    return { success: !!j?.success };
  }

  return { success: false };
}

// --- EXTEND ACTIVE PLAN HORIZON (AI dopĺňanie) -------------------

export type ExtendPlanResult = {
  success: boolean;
  extended_days: number;
  plan_start: string;
  plan_end: string;
  horizon_days: number;
  inserted_rows?: number;
  note?: string;
};

export async function apiExtendActivePlan(
  userId: number,
  minHorizonDays = 10
): Promise<ExtendPlanResult> {
  if (!API_URL) {
    console.warn("[coach.plan] extendActivePlan – missing API_URL");
    return {
      success: false,
      extended_days: 0,
      plan_start: "",
      plan_end: "",
      horizon_days: 0,
      note: "missing_api_url",
    };
  }

  const r = await fetch(
    `${API_URL}/coach-plan/${userId}/extend?min_horizon_days=${minHorizonDays}`,
    {
      method: "POST",
    }
  ).catch((err) => {
    console.error("[coach.plan] extendActivePlan fetch error", err);
    return null;
  });

  if (r && r.ok) {
    const j = await r.json().catch(() => ({}));
    return j as ExtendPlanResult;
  }

  return {
    success: false,
    extended_days: 0,
    plan_start: "",
    plan_end: "",
    horizon_days: 0,
    note: "http_error",
  };
}