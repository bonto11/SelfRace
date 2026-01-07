// src/features/coach/api/coach_athlete_state.ts
import { callBackend } from "@/app/shared/utils/callBackend";
import type {
  AnalyzeOptions,
  AnalyzeAthleteStateResponse,
} from "@/app/features/coach/types/coachApiTypes";


type AsyncJobRow = {
  id: number;
  user_id: number;
  job_type: string;
  status: string;
  progress: number;
  error: string | null;
  result: any | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

type EnqueueJobResponse = {
  success: boolean;
  job: AsyncJobRow | null;
  note?: string | null;
  detail?: string | null;
  error?: string | null;
};

type RunJobResponse = {
  success: boolean;
  job: AsyncJobRow | null;
  error?: string | null;
};

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
  detail?: string | null;
  error?: string | null;
};

export type AthleteProgressRecord = {
  id: number;
  user_id: number;
  version: number;
  created_at: string;
  compare_previous: any | null;
};

type LatestAthleteProgressResponse = {
  success: boolean;
  progress: AthleteProgressRecord | null;
  detail?: string | null;
  error?: string | null;
};
export async function apiAnalyzeAthleteState(
  userId: number,
  userUuid: string,
  opts: AnalyzeOptions = {}
): Promise<AnalyzeAthleteStateResponse> {
  if (!userId) throw new Error("Missing userId in apiAnalyzeAthleteState");
  if (!userUuid) throw new Error("Missing userUuid in apiAnalyzeAthleteState");

  // 1) ENQUEUE JOB
  const enqueuePath = `/jobs/enqueue/${encodeURIComponent(String(userId))}`;

  const enqueueBody = {
    job_type: "ai_analyze",
    user_uuid: userUuid,
    payload: {
      debug: !!opts.debugRaw,
      save_to_db: true,
      model: opts.explicitModel ?? "coach-analyze-stub",
    },
    priority: 100,
    max_attempts: 1,
    dedupe_key: "ai_analyze_latest",
  };

  let enqueueJson: EnqueueJobResponse;
  try {
    enqueueJson = await callBackend<EnqueueJobResponse>(enqueuePath, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(enqueueBody),
    });
  } catch (e: any) {
    console.error("[Coach][apiAnalyzeAthleteState] enqueue ERROR", e);
    throw e instanceof Error
      ? e
      : new Error(`Network/BE error (enqueue): ${String(e)}`);
  }

  if (!enqueueJson?.success || !enqueueJson.job) {
    const msg =
      enqueueJson.detail ||
      enqueueJson.error ||
      enqueueJson.note ||
      "Failed to enqueue ai_analyze job";
    throw new Error(msg);
  }

  const jobId = enqueueJson.job.id;

  // 2) RUN JOB TERAZ (sync worker endpoint)
  const runPath = `/jobs/run/${encodeURIComponent(
    String(userId)
  )}/${encodeURIComponent(String(jobId))}`;

  let runJson: RunJobResponse;
  try {
    runJson = await callBackend<RunJobResponse>(runPath, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[Coach][apiAnalyzeAthleteState] run ERROR", e);
    throw e instanceof Error
      ? e
      : new Error(`Network/BE error (run): ${String(e)}`);
  }

  if (!runJson?.success || !runJson.job) {
    const msg = runJson?.error || "Job run failed";
    throw new Error(msg);
  }

  const result = runJson.job.result;

  if (!result || typeof result !== "object") {
    throw new Error("Job finished but result payload is empty or invalid");
  }

  // 3) Výstup presne v tvare, ktorý UI čaká
  const out: AnalyzeAthleteStateResponse = {
    success: true,
    ...(result as any),
  };

  return out;
}

/**
 * GET /coach/athlete/state/latest/:user_id
 */
export async function apiGetLatestAthleteState(
  userId: number
): Promise<AthleteStateRecord | null> {
  if (!userId) throw new Error("Missing userId in apiGetLatestAthleteState");

  const path = `/coach/athlete/state/latest/${encodeURIComponent(
    String(userId)
  )}`;

  let json: LatestAthleteStateResponse;
  try {
    json = await callBackend<LatestAthleteStateResponse>(path, {
      method: "GET",
      cache: "no-store",
    });
  } catch (e: any) {
    console.error("[Coach][apiGetLatestAthleteState] ERROR", e);
    throw e instanceof Error
      ? e
      : new Error(`Network/BE error (latest state): ${String(e)}`);
  }

  if (!json?.success) {
    const msg = json.detail || json.error || "Failed to load latest athlete state";
    throw new Error(msg);
  }

  return json.state ?? null;
}

/**
 * GET /coach/athlete/state/latest-progress/:user_id
 * – pre Weekly Coach Progress widget
 */
export async function apiGetLatestAthleteProgress(
  userId: number
): Promise<AthleteProgressRecord | null> {
  if (!userId) {
    throw new Error("Missing userId in apiGetLatestAthleteProgress");
  }

  const path = `/coach/athlete/state/latest-progress/${encodeURIComponent(
    String(userId)
  )}`;

  let json: LatestAthleteProgressResponse;
  try {
    json = await callBackend<LatestAthleteProgressResponse>(path, {
      method: "GET",
      cache: "no-store",
    });
  } catch (e: any) {
    console.error("[Coach][apiGetLatestAthleteProgress] ERROR", e);
    throw e instanceof Error
      ? e
      : new Error(`Network/BE error (latest progress): ${String(e)}`);
  }

  if (!json?.success) {
    const msg =
      json.detail || json.error || "Failed to load latest athlete progress";
    throw new Error(msg);
  }

  return json.progress ?? null;
}