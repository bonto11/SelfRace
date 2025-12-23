// src/features/coach/api/coach_plan_weekly.ts
import { API_URL } from "@/app/shared/config";
import { robustJson } from "@/app/features/coach/api/_api_utils";

/* ---------- spoločné typy pre async_jobs (rovnaké ako pri analyze) ---------- */

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
};

type RunJobResponse = {
  success: boolean;
  job: AsyncJobRow | null;
};

/* ---------- options pre generate ---------- */

export type WeeklyPlanGenerateOptions = {
  overwrite?: boolean;
  state_id?: number | null; // id z coach_athlete_state
  weeks?: number | null; // koľko týždňov
};

/**
 * POST /coach-plan-weekly/generate/{user_id}
 * NOVO: ide cez async_jobs (job_type = "weekly_generate")
 */
export async function apiGenerateWeeklyPlan(
  userId: number,
  userUuid: string,
  opts: WeeklyPlanGenerateOptions = {}
): Promise<any> {
  if (!API_URL) throw new Error("API_URL is not configured");

  // 1) ENQUEUE JOB
  const enqueueUrl = `${API_URL}/jobs/enqueue/${userId}`;

  const payload = {
    overwrite: opts.overwrite ?? true,
    state_id: opts.state_id ?? null,
    weeks: opts.weeks ?? null,
  };

  const enqueueBody = {
    job_type: "weekly_generate",
    user_uuid: userUuid,
    payload,
    priority: 100,
    max_attempts: 1,
    dedupe_key: "weekly_generate_latest",
  };

  const enqueueRes = await fetch(enqueueUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(enqueueBody),
  }).catch((err) => {
    throw new Error(`Network/CORS (enqueue weekly): ${String(err)}`);
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
    headers: { "content-type": "application/json" },
    cache: "no-store",
  }).catch((err) => {
    throw new Error(`Network/CORS (run weekly): ${String(err)}`);
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
    throw new Error(
      "Weekly job finished but result payload is empty or invalid"
    );
  }

  return {
    success: true,
    ...(result as any),
  };
}

/* ---- STARÁ priama verzia cez /coach-plan-weekly/generate/{user_id} (ponechaná ako komentár) ----
export async function apiGenerateWeeklyPlan(
  userId: number,
  opts: WeeklyPlanGenerateOptions = {}
): Promise<any> {
  if (!API_URL) throw new Error("API_URL is not configured");

  const payload = {
    overwrite: opts.overwrite ?? true,
    state_id: opts.state_id ?? null,
    weeks: opts.weeks ?? null,
  };

  const res = await fetch(`${API_URL}/coach-plan-weekly/generate/${userId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((err) => {
    throw new Error(`Network/CORS: ${String(err)}`);
  });

  const json = await robustJson(res);
  if (!res.ok || json?.success === false) {
    throw new Error(json?.detail || json?.error || `HTTP ${res.status}`);
  }
  return json;
}
*/

/* ---------- typy + GET latest (bez zmeny) ---------- */

export type WeeklyPlanWeek = {
  week_index: number;
  week_start: string | null;
  week_end: string | null;
  goal?: string | null;
  focus?: string | null;
  load_phase?: string | null;
  planned_km?: number | null;
  planned_minutes?: number | null;
  completed_km?: number | null;
  completed_minutes?: number | null;
  notes?: string | null;
  raw_json?: any;
};

export type WeeklyPlanLatest = {
  plan_id: string;
  weeks: WeeklyPlanWeek[];
};

type WeeklyPlanLatestResponse = {
  success: boolean;
  plan: WeeklyPlanLatest | null;
};

/**
 * GET /coach-plan-weekly/latest/{user_id}
 */
export async function apiGetLatestWeeklyPlan(
  userId: number
): Promise<WeeklyPlanLatest | null> {
  if (!API_URL) throw new Error("API_URL is not configured");

  const res = await fetch(`${API_URL}/coach-plan-weekly/latest/${userId}`, {
    method: "GET",
    headers: { "content-type": "application/json" },
    cache: "no-store",
  }).catch((err) => {
    throw new Error(`Network/CORS: ${String(err)}`);
  });

  const json = (await robustJson(res)) as WeeklyPlanLatestResponse;

  if (!res.ok || json?.success === false) {
    throw new Error(
      (json as any)?.detail || (json as any)?.error || `HTTP ${res.status}`
    );
  }

  return json.plan ?? null;
}
