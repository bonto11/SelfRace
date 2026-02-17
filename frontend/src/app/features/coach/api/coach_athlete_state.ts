// src/features/coach/api/coach_athlete_state.ts
import { callBackend } from "@/app/shared/utils/callBackend";
import type {
  AnalyzeOptions,
  AnalyzeAthleteStateResponse,
} from "@/app/features/coach/types/coachApiTypes";

export type AthleteProgressRecord = {
  id: number;
  user_id: number;
  model: string | null;
  version: number;
  created_at: string;
  report: any | null; 
};

type LatestAthleteProgressResponse = {
  success: boolean;
  item: AthleteProgressRecord | null;
  detail?: string | null;
  error?: string | null;
};

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

export type AthleteStateRecord = {
  id: number;
  user_id: number;
  model: string | null;
  version: number;
  created_at: string;
  state: any; 
};

type LatestAthleteStateResponse = {
  success: boolean;
  state: AthleteStateRecord | null;
  detail?: string | null;
  error?: string | null;
};

export async function apiAnalyzeAthleteState(
  userId: number,
  userUuid: string,
  opts: AnalyzeOptions = {}
): Promise<AnalyzeAthleteStateResponse> {
  if (!userId) throw new Error("api.common.missingUserAuth");
  if (!userUuid) throw new Error("api.common.missingUserAuth");

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
    throw new Error("api.coach.enqueueFailed");
  }

  if (!enqueueJson?.success || !enqueueJson.job) {
    throw new Error("api.coach.enqueueFailed");
  }

  const jobId = enqueueJson.job.id;

  const runPath = `/jobs/run/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(jobId))}`;

  let runJson: RunJobResponse;
  try {
    runJson = await callBackend<RunJobResponse>(runPath, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[Coach][apiAnalyzeAthleteState] run ERROR", e);
    throw new Error("api.coach.runFailed");
  }

  if (!runJson?.success || !runJson.job) {
    throw new Error("api.coach.runFailed");
  }

  const result = runJson.job.result;

  maybeThrowAiQuotaError(result);

  if (!result || typeof result !== "object") {
    throw new Error("api.coach.invalidResult");
  }

  const out: AnalyzeAthleteStateResponse = {
    success: true,
    ...(result as any),
  };

  return out;
}

export async function apiGetLatestAthleteState(
  userId: number
): Promise<AthleteStateRecord | null> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/coach/athlete/state/latest/${encodeURIComponent(String(userId))}`;

  try {
    const json = await callBackend<LatestAthleteStateResponse>(path, {
      method: "GET",
      cache: "no-store",
    });

    if (!json?.success) {
      throw new Error("api.coach.stateLoadFailed");
    }

    return json.state ?? null;
  } catch (e: any) {
    console.error("[Coach][apiGetLatestAthleteState] ERROR", e);
    throw new Error("api.coach.stateLoadFailed");
  }
}

export async function apiGetLatestAthleteProgress(
  userId: number
): Promise<AthleteProgressRecord | null> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/coach/athlete/state/latest-progress/${encodeURIComponent(String(userId))}`;

  try {
    const json = await callBackend<LatestAthleteProgressResponse>(path, {
      method: "GET",
      cache: "no-store",
    });

    if (!json?.success) {
      throw new Error("api.coach.progressLoadFailed");
    }

    return json.item ?? null;
  } catch (e: any) {
    console.error("[Coach][apiGetLatestAthleteProgress] ERROR", e);
    throw new Error("api.coach.progressLoadFailed");
  }
}

// ---- AI error helpers (quota) ----

export type AiBackendError = {
  code?: string | null;
  message?: string | null;
  used_tokens_this_month?: number | null;
};

export function maybeThrowAiQuotaError(result: any) {
  if (!result || typeof result !== "object") return;

  const err: AiBackendError | undefined = (result as any).error;
  if (!err || err.code !== "ai_quota_exceeded") return;

  const e = new Error("api.coach.aiQuotaExceeded");
  (e as any).code = err.code;
  (e as any).usedTokensThisMonth = err.used_tokens_this_month ?? null;

  throw e;
}