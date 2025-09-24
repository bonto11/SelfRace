// src/features/coach/api/goals.ts
import { API_URL } from "@/shared/config";

export async function getGoalsCatalog() {
  const r = await fetch(`${API_URL}/coach/goals/catalog`, {
    cache: "force-cache",
  });
  if (!r.ok) throw new Error(`goals catalog failed: ${r.status}`);
  return r.json();
}

export async function estimateGoal(
  userId: number,
  payload: {
    distance: string;
    current_pace: string;
    target_pace: string;
    weeks?: number;
  }
) {
  const r = await fetch(`${API_URL}/coach/goals/estimate/${userId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`goals estimate failed: ${r.status}`);
  return r.json();
}
