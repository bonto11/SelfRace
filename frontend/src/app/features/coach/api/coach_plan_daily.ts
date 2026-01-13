import { callBackend } from "@/app/shared/utils/callBackend";
import { maybeThrowAiQuotaError } from "@/app/features/coach/api/coach_athlete_state";

/* ============ spoločné typy pre async_jobs (rovnaké ako inde) ============ */

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

/* ============ typy ============ */

export type DailyWeekGenerateOptions = {
  week_index: number; // 1-based index v weekly pláne
  plan_id?: string | null; // ak null → posledný aktívny plán
  overwrite?: boolean;
};

/* ============ GENERATE WEEK (coach-plan-daily) ============ */

/**
 * POST /jobs/enqueue/{user_id} (daily_generate)
 * POST /jobs/run/{user_id}/{job_id}
 */
export async function apiGenerateDailyForWeek(
  userId: number,
  userUuid: string,
  opts: DailyWeekGenerateOptions
): Promise<any> {
  if (!userId) throw new Error("userId is required in apiGenerateDailyForWeek");
  if (!opts || typeof opts.week_index !== "number") {
    throw new Error("week_index is required for apiGenerateDailyForWeek");
  }

  const payload = {
    week_index: opts.week_index,
    plan_id: opts.plan_id ?? null,
    overwrite: opts.overwrite ?? true,
    debug: true,
  };

  // 1) ENQUEUE JOB
  const enqueuePath = `/jobs/enqueue/${encodeURIComponent(String(userId))}`;

  const enqueueBody = {
    job_type: "daily_generate",
    user_uuid: userUuid,
    payload,
    priority: 100,
    max_attempts: 1,
    dedupe_key: `daily_generate_week_${opts.week_index}`,
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
    console.error("[Coach][apiGenerateDailyForWeek][enqueue] ERROR", err);
    throw err instanceof Error
      ? err
      : new Error(`Network/BE error (enqueue daily): ${String(err)}`);
  }

  if (!enqueueJson?.success || !enqueueJson.job) {
    const msg =
      enqueueJson.detail ||
      enqueueJson.error ||
      enqueueJson.note ||
      "Failed to enqueue daily_generate job";
    throw new Error(msg);
  }

  const jobId = enqueueJson.job.id;

  // 2) RUN JOB TERAZ
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
    console.error("[Coach][apiGenerateDailyForWeek][run] ERROR", err);
    throw err instanceof Error
      ? err
      : new Error(`Network/BE error (run daily): ${String(err)}`);
  }

  if (!runJson?.success || !runJson.job) {
    const msg =
      runJson.detail ||
      runJson.error ||
      "Daily_generate job failed or has no job payload";
    throw new Error(msg);
  }

  const result = runJson.job.result;

  // 👇 AI kvóta – ak BE vráti { error: { code: "ai_quota_exceeded", ... } }
  maybeThrowAiQuotaError(result);

  if (!result || typeof result !== "object") {
    throw new Error(
      "Daily job finished but result payload is empty or invalid"
    );
  }

  return {
    success: true,
    ...(result as any),
  };
}

/* ============ DAILY OVERVIEW (coach-plan-daily) ============ */

export type DailyPlanStructure = {
  warmup?:
    | {
        minutes?: number | null;
        notes?: string | null;
      }
    | null;
  // MAIN je pole blokov (intervaly)
  main?: any[] | null;
  cooldown?:
    | {
        minutes?: number | null;
        notes?: string | null;
      }
    | null;
  // pre silovku – už po enrichmente z BE
  strength_exercises?: any[] | null;
};

export type DailyPlanSession = {
  sport: string;
  title: string | null;
  duration_min: number | null;
  intensity: string | null;
  notes: string | null;
  zone_text?: string | null;
  session_type?: string | null;
  structure?: DailyPlanStructure | null;
};

export type DailyPlanDay = {
  date: string; // "YYYY-MM-DD"
  sessions: DailyPlanSession[];
};

export type DailyOverview = {
  horizon_days: number;
  days: DailyPlanDay[];
};

type DailyOverviewResponse = {
  success: boolean;
  overview: DailyOverview | null;
  detail?: string | null;
  error?: string | null;
};

/**
 * GET /coach-plan-daily/overview/{user_id}
 */
export async function apiGetDailyOverview(
  userId: number
): Promise<DailyOverview | null> {
  if (!userId) throw new Error("userId is required in apiGetDailyOverview");

  const path = `/coach-plan-daily/overview/${encodeURIComponent(
    String(userId)
  )}`;

  let json: DailyOverviewResponse;
  try {
    json = await callBackend<DailyOverviewResponse>(path, {
      method: "GET",
      headers: { "content-type": "application/json" },
      cache: "no-store",
    });
  } catch (err: any) {
    console.error("[Coach][apiGetDailyOverview] ERROR", err);
    throw err instanceof Error
      ? err
      : new Error(`Network/BE error (daily overview): ${String(err)}`);
  }

  if (!json?.success) {
    throw new Error(
      json.detail || json.error || "Failed to load daily overview"
    );
  }

  return json.overview ?? null;
}