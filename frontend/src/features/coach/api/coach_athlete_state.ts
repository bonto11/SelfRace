// src/features/coach/api/coach_athlete_state.ts

import { API_URL } from "@/shared/config";
import { robustJson } from "@/features/coach/api/_api_utils";
import type {
  AnalyzePayloadBE,
  AnalyzeOptions,
  AnalyzeAthleteStateResponse,
} from "@/features/coach/types/coachApiTypes";

/**
 * Zavolá BE endpoint /coach/athlete/analyze/:user_id
 * a vráti rozparsovanú odpoveď. Žiadna logika okolo prefs.
 */
export async function apiAnalyzeAthleteState(
  userId: number,
  payload: AnalyzePayloadBE,
  opts: AnalyzeOptions = {}
): Promise<AnalyzeAthleteStateResponse> {
  if (!API_URL) {
    throw new Error("Missing API_URL for apiAnalyzeAthleteState");
  }

  const url = `${API_URL}/coach/athlete/analyze/${userId}`;

  const body = {
    ...payload,
    debug: !!opts.debugRaw,
    save_to_db: true,
    model: opts.explicitModel ?? "coach-analyze-stub",
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(body),
  }).catch((e) => {
    throw new Error(`Network/CORS: ${String(e)}`);
  });

  const json = await robustJson(res);
  if (!res.ok || !json?.success) {
    const msg = json?.detail || json?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return json as AnalyzeAthleteStateResponse;
}