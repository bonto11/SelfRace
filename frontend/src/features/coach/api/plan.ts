// src/features/coach/api/plan.ts
import { API_URL } from "@/shared/config";

export async function saveActivePlan(
  userId: number,
  analysis: any,
  meta?: any
) {
  if (!analysis || !analysis.next_10_days) {
    throw new Error("saveActivePlan: analysis.next_10_days is missing");
  }

  const payload = {
    next_10_days: analysis.next_10_days,
    overwrite: true,
    meta: meta ?? null,
  };

  const r = await fetch(`${API_URL}/coach/plan/${userId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => null);

  if (r && r.ok) {
    const j = await r.json().catch(() => ({}));
    return { success: true, via: "api", ...j };
  }

  // fallback → localStorage
  try {
    const localPayload = { analysis, meta: meta ?? null };
    localStorage.setItem("coach.active", JSON.stringify(localPayload));
    return { success: true, via: "local" };
  } catch {
    throw new Error("saveActivePlan failed");
  }
}

export async function loadActivePlan(
  userId: number,
  params?: { from?: string; to?: string; planId?: string }
) {
  const qs = new URLSearchParams();
  if (params?.from) qs.set("date_from", params.from);
  if (params?.to) qs.set("date_to", params.to);
  if (params?.planId) qs.set("plan_id", params.planId);

  const url =
    qs.toString().length > 0
      ? `${API_URL}/coach/plan/${userId}?${qs.toString()}`
      : `${API_URL}/coach/plan/${userId}`;

  const r = await fetch(url, { cache: "no-store" }).catch(() => null);
  if (r && r.ok) {
    const j = await r.json().catch(() => ({}));
    return j; // { success, data, plan_id }
  }

  // fallback → localStorage
  try {
    const raw = localStorage.getItem("coach.active");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function updateActivePlan(userId: number) {
  // zatiaľ len re-load z DB; keď neskôr pridáš reconcile v BE, prerobíme to
  const current = await loadActivePlan(userId);
  return current;
}