// src/features/coach/api/coach_athlete_state.ts
import { callBackend, runAsyncJobWithPolling } from "@/app/shared/utils/callBackend";
import type { AnalyzeOptions } from "@/app/features/coach/types/coachApiTypes";

export type AthleteProgressRecord = {
  id: number;
  user_id: number;
  model: string | null;
  version: number;
  created_at: string;
  report: any | null; 
};

export type AthleteStateRecord = {
  id: number;
  user_id: number;
  model: string | null;
  version: number;
  created_at: string;
  state: any; 
};


// (Vymazal som tie tvoje dlhé typy pre JobRecord, už ich netreba vďaka utils)

export async function apiAnalyzeAthleteState(
  userId: number,
  userUuid: string,
  opts: AnalyzeOptions = {}
): Promise<{ success: boolean; status?: string; error_code?: string; message?: string; data?: any }> {
  if (!userId || !userUuid) throw new Error("api.common.missingUserAuth");

  const enqueuePath = `/jobs/enqueue/${encodeURIComponent(String(userId))}`;
  const enqueueBody = {
    job_type: "ai_analyze",
    payload: {
      debug: !!opts.debugRaw,
      save_to_db: true,
      model: opts.explicitModel ?? "coach-analyze-stub",
    },
    priority: 100,
    max_attempts: 1,
    dedupe_key: "ai_analyze_latest",
  };

  let enqueueJson: any;
  try {
    enqueueJson = await callBackend(enqueuePath, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(enqueueBody),
    });
  } catch (e: any) {
    console.error("[Coach][apiAnalyzeAthleteState] enqueue ERROR", e);
    return { success: false, error_code: "enqueue_failed", message: "Network error" };
  }

  if (!enqueueJson?.success) {
    return {
      success: false,
      error_code: enqueueJson?.error_code || "REQUEST_FAILED",
      message: enqueueJson?.message || "Nepodarilo sa zaradiť požiadavku.",
    };
  }

  const jobId = enqueueJson.job?.id || enqueueJson.data?.job_id;
  if (!jobId) {
    return { success: true, status: "QUEUED" };
  }

  return await runAsyncJobWithPolling(userId, jobId);
}

// ... (Zvyšok súboru ako apiGetLatestAthleteState a apiGetLatestAthleteProgress nechaj rovnako) ...
export async function apiGetLatestAthleteState(userId: number): Promise<AthleteStateRecord | null> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/coach/athlete/state/latest/${encodeURIComponent(String(userId))}`;

  try {
    const json = await callBackend<any>(path, {
      method: "GET",
      cache: "no-store",
    });

    if (!json?.success) return null;
    return json.data || json.state || null;
  } catch (e: any) {
    console.error("[Coach][apiGetLatestAthleteState] ERROR", e);
    throw new Error("api.coach.stateLoadFailed");
  }
}

export async function apiGetLatestAthleteProgress(userId: number): Promise<AthleteProgressRecord | null> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/coach/athlete/state/latest-progress/${encodeURIComponent(String(userId))}`;

  try {
    const json = await callBackend<any>(path, {
      method: "GET",
      cache: "no-store",
    });

    if (!json?.success) return null;
    return json.data || json.item || null;
  } catch (e: any) {
    console.error("[Coach][apiGetLatestAthleteProgress] ERROR", e);
    throw new Error("api.coach.progressLoadFailed");
  }
}