// src/features/coach/api/coach.ts
import { API_URL } from "@/shared/config";
import type {
  CoachPrefs,               // CHANGED: berieme kanonické typy
  GoalKind,
  SportKind,
} from "@/features/coach/types/prefsTypes";

// BE pôvodne čakal { weeks, goal, primary_sports: string[] }.
// Pridávam adapter, ktorý z CoachPrefs vytvorí payload pre BE.
type AnalyzePayloadBE = {
  weeks: number;
  goal: string;                  // napr. "improve_overall" alebo "race_time:5k"
  primary_sports: string[];      // ["run","ride",...]
};

// NEW: adapter z našich prefs → payload pre BE
export function toAnalyzePayloadBE(prefs: CoachPrefs): AnalyzePayloadBE {
  const weeks = prefs.weeks ?? 8;

  const gk = prefs.goal_kind ?? "improve_overall";
  let goal: string = gk;  // ✅ typ string, nie GoalKind
  const race = prefs.targets?.run?.race_goal;

  if (gk === "race_time" && race) {
    goal = `race_time:${race}`;  // teraz povolené
  }

  const primary = (prefs.primary_sports ?? prefs.sports ?? []) as SportKind[];
  const primary_sports = primary.length ? primary.map(String) : ["run", "ride", "strength"];

  return { weeks, goal, primary_sports };
}

export async function analyzeCoach(
  userId: number,
  prefsOrPayload: CoachPrefs | AnalyzePayloadBE
) {
  const payload: AnalyzePayloadBE =
    "primary_sports" in prefsOrPayload
      ? (prefsOrPayload as AnalyzePayloadBE)
      : toAnalyzePayloadBE(prefsOrPayload as CoachPrefs);

  const res = await fetch(`${API_URL}/coach/analyze/${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(payload),
  });

  let json: any = null;
  try { json = await res.json(); } catch { /* ignore */ }

  if (!res.ok || !json?.success) {
    const msg = json?.detail || json?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json; // nechávam raw, kým nemáme presný Response type
}

export async function sendCoachFeedback(userId: number, body: unknown) {
  const res = await fetch(`${API_URL}/coach/feedback/${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(body ?? {}),
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* ignore */ }
  if (!res.ok || !json?.success) {
    throw new Error(json?.detail || `HTTP ${res.status}`);
  }
  return json;
}