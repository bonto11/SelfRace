// src/features/coach/api/goals.ts
import { API_URL } from "@/shared/config";
import type { CoachPrefs } from "@/features/coach/types/prefsTypes";

// nechávam generic typy odpovedí – BE kontrakt ešte ladíme
export async function getGoalsCatalog() {
  const r = await fetch(`${API_URL}/coach/goals/catalog`, { cache: "force-cache" });
  if (!r.ok) throw new Error(`goals catalog failed: ${r.status}`);
  return r.json();
}

export async function estimateGoal(
  userId: number,
  payload: {
    distance: string;       // "5k" | "10k" | "half" | "marathon"
    current_pace: string;   // "5:10"
    target_pace: string;    // "4:30"
    weeks?: number;
  }
) {
  const r = await fetch(`${API_URL}/coach/goals/estimate/${userId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`goals estimate failed: ${r.status}`);
  return r.json();
}

// OPTIONAL helper – ak chceš spraviť payload priamo z CoachPrefs:
export function prefsToEstimatePayload(prefs: CoachPrefs) {
  return {
    distance: prefs.targets?.run?.race_goal ?? "5k",
    current_pace: prefs.current_pace ?? "5:00",
    target_pace: prefs.target_pace ?? "4:30",
    weeks: prefs.weeks ?? 8,
  };
}