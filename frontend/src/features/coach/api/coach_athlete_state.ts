// src/features/coach/api/coach_athlete_state.ts
import {
  COACH_API_BASE,
  robustJson,
} from "@/features/coach/api/_api_utils";

import type {
  AnalyzePayloadBE,
  AnalyzeOptions,
} from "@/features/coach/types/coachApiTypes";

export async function apiAnalyzeAthleteState(
  userId: number,
  payload: AnalyzePayloadBE,
  opts: AnalyzeOptions = {}
) {
  if (!COACH_API_BASE) {
    throw new Error("Missing API_URL for coach backend.");
  }

  const params = new URLSearchParams();
  if (opts.debugRaw) params.set("debug_raw", "1");
  if (opts.loose) params.set("loose", "1");

  const url = `${COACH_API_BASE}/coach-state/analyze/${userId}${
    params.toString() ? `?${params}` : ""
  }`;

  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (opts.explicitModel) headers["X-Model"] = opts.explicitModel;

  const res = await fetch(url, {
    method: "POST",
    headers,
    cache: "no-store",
    body: JSON.stringify(payload),
  }).catch((e) => {
    throw new Error(`Network/CORS: ${String(e)}`);
  });

  const json = await robustJson(res);
  if (!res.ok || !json?.success) {
    const msg = json?.detail || json?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}