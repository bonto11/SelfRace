// src/features/coach/api/plan.ts
import { API_URL } from "@/shared/config";

const DEV_COACH_DEBUG = false;

function dlog(...args: any[]) {
  if (!DEV_COACH_DEBUG) return;
  // eslint-disable-next-line no-console
  console.log("[coach/plan/api]", ...args);
}

export async function saveActivePlan(
  userId: number,
  analysis: any,
  meta?: any
) {
  const payload = {
    next_10_days: analysis?.next_10_days ?? [],
    meta: meta ?? null,
    overwrite: true,
  };

  dlog("saveActivePlan payload", { userId, payload });

  const url = `${API_URL}/coach/plan/${userId}`;

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    dlog("saveActivePlan response", r.status, r.statusText);

    if (r.ok) {
      const j = await r.json().catch(() => ({}));
      dlog("saveActivePlan json", j);
      try {
        localStorage.setItem("coach.active", JSON.stringify(analysis));
      } catch {
        // ignore
      }
      return { success: true, via: "api", meta: j };
    }

    // fallback → localStorage
    dlog("saveActivePlan fallback to localStorage");
    try {
      localStorage.setItem("coach.active", JSON.stringify(analysis));
      return { success: true, via: "local" };
    } catch (e) {
      throw new Error(`saveActivePlan failed, status=${r.status}`);
    }
  } catch (e: any) {
    dlog("saveActivePlan error", e);
    // posledný fallback
    try {
      localStorage.setItem("coach.active", JSON.stringify(analysis));
      return { success: true, via: "local-error" };
    } catch {
      throw new Error(e?.message || "saveActivePlan failed");
    }
  }
}

export async function loadActivePlan(userId: number) {
  const url = `${API_URL}/coach/plan/${userId}`;
  dlog("loadActivePlan url", url);

  try {
    const r = await fetch(url, { cache: "no-store" }).catch(() => null);
    if (r && r.ok) {
      const j = await r.json().catch(() => ({}));
      dlog("loadActivePlan api json", j);
      // vrátime len raw sessions; neskôr môžeš riešiť rekonštrukciu
      return j?.data ?? null;
    }
  } catch (e) {
    dlog("loadActivePlan api error", e);
  }

  try {
    const raw = localStorage.getItem("coach.active");
    const parsed = raw ? JSON.parse(raw) : null;
    dlog("loadActivePlan localStorage", parsed);
    return parsed;
  } catch {
    return null;
  }
}

export async function updateActivePlan(userId: number) {
  // zatiaľ žiadny PATCH endpoint → len refrešni z BE alebo localStorage
  dlog("updateActivePlan", userId);
  return loadActivePlan(userId);
}