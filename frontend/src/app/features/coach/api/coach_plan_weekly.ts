import { callBackend } from "@/app/shared/utils/callBackend";
import { maybeThrowAiQuotaError } from "@/app/features/coach/api/coach_athlete_state";

/* ---------- spoločné typy pre async_jobs (rovnaké ako pri analyze/daily) ---------- */

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
  detail?: string | null;
  error?: string | null;
};

/* ---------- options pre generate ---------- */

export type WeeklyPlanGenerateOptions = {
  overwrite?: boolean;
  state_id?: number | null; // id z coach_athlete_state
  weeks?: number | null; // koľko týždňov
};

/**
 * POST /jobs/enqueue/{user_id} (weekly_generate)
 * POST /jobs/run/{user_id}/{job_id}
 */
export async function apiGenerateWeeklyPlan(
  userId: number,
  userUuid: string,
  opts: WeeklyPlanGenerateOptions = {}
): Promise<any> {
  if (!userId) throw new Error("userId is required in apiGenerateWeeklyPlan");

  const payload = {
    overwrite: opts.overwrite ?? true,
    state_id: opts.state_id ?? null,
    weeks: opts.weeks ?? null,
  };

  // 1) ENQUEUE JOB
  const enqueuePath = `/jobs/enqueue/${encodeURIComponent(String(userId))}`;

  const enqueueBody = {
    job_type: "weekly_generate",
    user_uuid: userUuid,
    payload,
    priority: 100,
    max_attempts: 1,
    dedupe_key: "weekly_generate_latest",
  };

  let enqueueJson: EnqueueJobResponse;
  try {
    enqueueJson = await callBackend<EnqueueJobResponse>(enqueuePath, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(enqueueBody),
    });
  } catch (err: any) {
    console.error("[Coach][apiGenerateWeeklyPlan][enqueue] ERROR", err);
    throw err instanceof Error
      ? err
      : new Error(`Network/BE error (enqueue weekly): ${String(err)}`);
  }

  if (!enqueueJson?.success || !enqueueJson.job) {
    const msg =
      enqueueJson.detail ||
      enqueueJson.error ||
      enqueueJson.note ||
      "Failed to enqueue weekly_generate job";
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
      headers: { "content-type": "application/json" },
      cache: "no-store",
    });
  } catch (err: any) {
    console.error("[Coach][apiGenerateWeeklyPlan][run] ERROR", err);
    throw err instanceof Error
      ? err
      : new Error(`Network/BE error (run weekly): ${String(err)}`);
  }

  if (!runJson?.success || !runJson.job) {
    const msg =
      runJson.detail ||
      runJson.error ||
      "Weekly_generate job failed or has no job payload";
    throw new Error(msg);
  }

  const result = runJson.job.result;

  // 👇 AI kvóta pre weekly plán
  maybeThrowAiQuotaError(result);

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

/* ---------- typy + GET latest ---------- */

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
  detail?: string | null;
  error?: string | null;
};

/**
 * GET /coach-plan-weekly/latest/{user_id}
 */
export async function apiGetLatestWeeklyPlan(
  userId: number
): Promise<WeeklyPlanLatest | null> {
  if (!userId) throw new Error("userId is required in apiGetLatestWeeklyPlan");

  const path = `/coach-plan-weekly/latest/${encodeURIComponent(String(userId))}`;

  let json: WeeklyPlanLatestResponse;
  try {
    json = await callBackend<WeeklyPlanLatestResponse>(path, {
      method: "GET",
      headers: { "content-type": "application/json" },
      cache: "no-store",
    });
  } catch (err: any) {
    console.error("[Coach][apiGetLatestWeeklyPlan] ERROR", err);
    throw err instanceof Error
      ? err
      : new Error(`Network/BE error (weekly latest): ${String(err)}`);
  }

  if (!json?.success) {
    throw new Error(
      json.detail || json.error || "Failed to load latest weekly plan"
    );
  }

  return json.plan ?? null;
}