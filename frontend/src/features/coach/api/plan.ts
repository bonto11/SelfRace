import { API_URL } from "@/shared/config";

export async function saveActivePlan(userId: number, payload: any) {
  // preferovaný endpoint
  const r = await fetch(`${API_URL}/coach/plan/${userId}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => null);

  if (r && r.ok) return { success: true, via: "api" };

  // fallback → localStorage
  try {
    localStorage.setItem("coach.active", JSON.stringify(payload));
    return { success: true, via: "local" };
  } catch (e) {
    throw new Error("saveActivePlan failed");
  }
}

export async function loadActivePlan(userId: number) {
  const r = await fetch(`${API_URL}/coach/plan/${userId}`, {
    cache: "no-store",
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

export async function updateActivePlan(userId: number) {
  const r = await fetch(`${API_URL}/coach/plan/${userId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "reconcile" }),
  }).catch(() => null);
  if (r && r.ok) {
    const j = await r.json().catch(() => ({}));
    return j?.plan ?? null;
  }
  // fallback: nič v BE → vráť, čo máme lokálne
  try {
    const raw = localStorage.getItem("coach.active");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}