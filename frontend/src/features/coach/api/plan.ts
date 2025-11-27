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
  const payload = {
    next_10_days: analysis?.next_10_days ?? [],
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

// staré load/update si nechaj ako sú, ak ich používaš inde
export async function apiUpdateActivePlan(userId: number) {
  if (!API_URL) {
    try {
      const raw = localStorage.getItem("coach.active");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  const r = await fetch(`${API_URL}/coach-plan/${userId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "reconcile" }),
  }).catch(() => null);

  if (r && r.ok) {
    const j = await r.json().catch(() => ({}));
    return j?.plan ?? null;
  }

  try {
    const raw = localStorage.getItem("coach.active");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Manuálne prelinkovanie jednej planned session na aktivitu.
 * activityId = null → odmapovanie.
 */
// NOVÉ: ručné mapovanie plán ↔ aktivita

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
  plan_date: string;      // "YYYY-MM-DD" – nový deň
  session_index: number;  // nové poradie v danom dni (0-based)
};

/**
 * Uloží zmeny v pláne (presuny medzi dňami + nové poradie).
 * - BE endpoint si potom vieš spraviť napr. na: POST /coach-plan-reorder/{user_id}
 * - updates: len zmenené riadky (id + nový plan_date + session_index)
 */
export async function apiSavePlanReorder(
  userId: number,
  updates: Array<{ id: number; plan_date: string; session_index: number }>
): Promise<{ success: boolean }> {
  if (!API_URL) {
    console.warn("[coach.plan] savePlanReorder – missing API_URL", { userId, updates });
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