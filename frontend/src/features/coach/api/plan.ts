// src/features/coach/api/plan.ts
import { API_URL } from "@/shared/config";

const COACH_DEBUG = true; // môžeš zdieľať rovnaký flag ako v komponentoch

/**
 * Uloží aktívny plán do BE.
 *
 * Podporuje 2 spôsoby volania:
 *  - saveActivePlan(userId, {plan, meta})  // legacy
 *  - saveActivePlan(userId, plan, meta)    // nový
 */
export async function saveActivePlan(
  userId: number,
  planOrPayload: any,
  meta?: any,
) {
  let payload: any;

  if (meta !== undefined) {
    // nový spôsob – dostali sme čistý plan + meta
    payload = { plan: planOrPayload, meta: meta ?? {} };
  } else {
    // starý spôsob – caller poslal už zložený payload
    payload = planOrPayload;
  }

  const url = `${API_URL}/coach/plan/${userId}`;

  if (COACH_DEBUG) {
    console.group("[CoachAPI] saveActivePlan");
    console.log("url", url);
    console.log("payload", payload);
  }

  let r: Response | null = null;

  try {
    r = await fetch(url, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    if (COACH_DEBUG) {
      console.error("[CoachAPI] saveActivePlan fetch error", e);
      console.groupEnd();
    }
    // fallback → localStorage
    try {
      localStorage.setItem("coach.active", JSON.stringify(payload));
      return { success: true, via: "local", error: "fetch_failed" };
    } catch {
      throw new Error("saveActivePlan failed (network + localStorage).");
    }
  }

  if (r && r.ok) {
    let body: any = null;
    try {
      body = await r.json();
    } catch {
      // nič
    }
    if (COACH_DEBUG) {
      console.log("response status", r.status);
      console.log("response body", body);
      console.groupEnd();
    }
    return { success: true, via: "api", body };
  }

  // BE neok → fallback localStorage
  if (COACH_DEBUG) {
    console.warn(
      "[CoachAPI] saveActivePlan non-ok response",
      r?.status,
      r && (await r.text().catch(() => "")),
    );
    console.groupEnd();
  }

  try {
    localStorage.setItem("coach.active", JSON.stringify(payload));
    return { success: true, via: "local", status: r?.status ?? 0 };
  } catch {
    throw new Error("saveActivePlan failed (API non-ok + localStorage).");
  }
}

export async function loadActivePlan(userId: number) {
  const url = `${API_URL}/coach/plan/${userId}`;

  if (COACH_DEBUG) {
    console.group("[CoachAPI] loadActivePlan");
    console.log("url", url);
  }

  let r: Response | null = null;
  try {
    r = await fetch(url, { cache: "no-store" });
  } catch (e) {
    if (COACH_DEBUG) {
      console.error("[CoachAPI] loadActivePlan fetch error", e);
      console.groupEnd();
    }
    // fallback → localStorage
    try {
      const raw = localStorage.getItem("coach.active");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  if (r && r.ok) {
    try {
      const j = await r.json();
      if (COACH_DEBUG) {
        console.log("response", j);
        console.groupEnd();
      }
      return j?.plan ?? null;
    } catch (e) {
      if (COACH_DEBUG) {
        console.error("[CoachAPI] loadActivePlan json error", e);
        console.groupEnd();
      }
      return null;
    }
  }

  if (COACH_DEBUG) {
    console.warn(
      "[CoachAPI] loadActivePlan non-ok status",
      r?.status,
      r && (await r.text().catch(() => "")),
    );
    console.groupEnd();
  }

  try {
    const raw = localStorage.getItem("coach.active");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function updateActivePlan(userId: number) {
  const url = `${API_URL}/coach/plan/${userId}`;

  if (COACH_DEBUG) {
    console.group("[CoachAPI] updateActivePlan");
    console.log("url", url);
  }

  let r: Response | null = null;

  try {
    r = await fetch(url, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "reconcile" }),
    });
  } catch (e) {
    if (COACH_DEBUG) {
      console.error("[CoachAPI] updateActivePlan fetch error", e);
      console.groupEnd();
    }
    // fallback: nič v BE → vráť, čo máme lokálne
    try {
      const raw = localStorage.getItem("coach.active");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  if (r && r.ok) {
    try {
      const j = await r.json();
      if (COACH_DEBUG) {
        console.log("response", j);
        console.groupEnd();
      }
      return j?.plan ?? null;
    } catch (e) {
      if (COACH_DEBUG) {
        console.error("[CoachAPI] updateActivePlan json error", e);
        console.groupEnd();
      }
      return null;
    }
  }

  if (COACH_DEBUG) {
    console.warn(
      "[CoachAPI] updateActivePlan non-ok status",
      r?.status,
      r && (await r.text().catch(() => "")),
    );
    console.groupEnd();
  }

  // fallback: nič v BE → vráť, čo máme lokálne
  try {
    const raw = localStorage.getItem("coach.active");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}