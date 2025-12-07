// src/features/coach/api/coach_athlete_state.ts

import { API_URL } from "@/shared/config";
import { robustJson } from "@/features/coach/api/_api_utils";
import type {
  AnalyzeOptions,
  AnalyzeAthleteStateResponse,
} from "@/features/coach/types/coachApiTypes";

/**
 * Typ pre jeden záznam v coach_athlete_state
 */
export type AthleteStateRecord = {
  id: number;
  user_id: number;
  model: string | null;
  version: number;
  created_at: string;
  state: any; // čistý JSON z AI
};

type LatestAthleteStateResponse = {
  success: boolean;
  state: AthleteStateRecord | null;
};

/**
 * Zavolá BE endpoint /coach/athlete/analyze/:user_id.
 * FE neposiela žiadny tréningový payload – BE si všetko skladá z DB.
 */
export async function apiAnalyzeAthleteState(
  userId: number,
  opts: AnalyzeOptions = {}
): Promise<AnalyzeAthleteStateResponse> {
  if (!API_URL) {
    throw new Error("Missing API_URL for apiAnalyzeAthleteState");
  }

  const url = `${API_URL}/coach/athlete/analyze/${userId}`;

  const body = {
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

/**
 * Zavolá BE endpoint /coach/athlete/state/latest/:user_id.
 * Vráti posledný uložený stav alebo null.
 */
export async function apiGetLatestAthleteState(
  userId: number
): Promise<AthleteStateRecord | null> {
  if (!API_URL) {
    throw new Error("Missing API_URL for apiGetLatestAthleteState");
  }

  const url = `${API_URL}/coach/athlete/state/latest/${userId}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  }).catch((e) => {
    throw new Error(`Network/CORS: ${String(e)}`);
  });

  const json = await robustJson(res) as LatestAthleteStateResponse;

  if (!res.ok || !json?.success) {
    const msg = (json as any)?.detail || (json as any)?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return json.state ?? null;
}