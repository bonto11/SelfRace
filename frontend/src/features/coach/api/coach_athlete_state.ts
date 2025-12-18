// src/features/coach/api/coach_athlete_state.ts
import { API_URL } from "@/shared/config";
import { robustJson } from "@/features/coach/api/_api_utils";
import type {
  AnalyzeOptions,
  AnalyzeAthleteStateResponse,
} from "@/features/coach/types/coachApiTypes";

type AsyncJobRow = {
  id: number;
  user_id: number;
  kind: string;
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
};

type RunJobResponse = {
  success: boolean;
  job: AsyncJobRow | null;
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
};

export async function apiAnalyzeAthleteState(
  userId: number,
  opts: AnalyzeOptions = {}
): Promise<AnalyzeAthleteStateResponse> {
  if (!API_URL) {
    throw new Error("Missing API_URL for apiAnalyzeAthleteState");
  }

  // 1) ENQUEUE JOB
  const enqueueUrl = `${API_URL}/jobs/enqueue/${userId}`;

  const enqueueBody = {
    job_type: "ai_analyze", // alebo "kind": "ai_analyze" ak to tak máš v BE
    payload: {
      debug: !!opts.debugRaw,
      save_to_db: true,
      model: opts.explicitModel ?? "coach-analyze-stub",
    },
    priority: 100,
    max_attempts: 1,
    dedupe_key: "ai_analyze_latest",
  };

  const enqueueRes = await fetch(enqueueUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(enqueueBody),
  }).catch((e) => {
    throw new Error(`Network/CORS (enqueue): ${String(e)}`);
  });

  const enqueueJson = (await robustJson(enqueueRes)) as EnqueueJobResponse;

  if (!enqueueRes.ok || !enqueueJson?.success || !enqueueJson.job) {
    const msg =
      (enqueueJson as any)?.detail ||
      (enqueueJson as any)?.error ||
      enqueueJson?.note ||
      `HTTP ${enqueueRes.status}`;
    throw new Error(msg);
  }

  const jobId = enqueueJson.job.id;

  // 2) RUN JOB TERAZ (sync worker endpoint)
  const runUrl = `${API_URL}/jobs/run/${userId}/${jobId}`;

  const runRes = await fetch(runUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  }).catch((e) => {
    throw new Error(`Network/CORS (run): ${String(e)}`);
  });

  const runJson = (await robustJson(runRes)) as RunJobResponse;

  if (!runRes.ok || !runJson?.success || !runJson.job) {
    const msg =
      (runJson as any)?.detail ||
      (runJson as any)?.error ||
      `HTTP ${runRes.status}`;
    throw new Error(msg);
  }

  const result = runJson.job.result;

  if (!result || typeof result !== "object") {
    throw new Error("Job finished but result payload is empty or invalid");
  }

  // 3) ZABALÍME RESULT DO FORMÁTU, KTORÝ UI ČAKÁ
  const out: AnalyzeAthleteStateResponse = {
    success: true,
    ...(result as any),
  };

  return out;
}

/**
 * POST /coach/athlete/analyze/:user_id
 */

/*
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
*/


/**
 * GET /coach/athlete/state/latest/:user_id
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

  const json = (await robustJson(res)) as LatestAthleteStateResponse;

  if (!res.ok || !json?.success) {
    const msg = (json as any)?.detail || (json as any)?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return json.state ?? null;
}