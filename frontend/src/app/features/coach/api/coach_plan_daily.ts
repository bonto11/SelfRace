// src/features/coach/api/coach_plan_daily.ts
import { callBackend } from "@/app/shared/utils/callBackend";
import { maybeThrowAiQuotaError } from "@/app/features/coach/api/coach_athlete_state";

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

export type DailyWeekGenerateOptions = {
  week_index: number;
  overwrite?: boolean;
};

export async function apiGenerateDailyForWeek(
  userId: number,
  userUuid: string,
  opts: DailyWeekGenerateOptions
): Promise<any> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const payload = {
    week_index: opts.week_index,
    overwrite: opts.overwrite ?? true,
    debug: true,
  };

  const enqueuePath = `/jobs/enqueue/${encodeURIComponent(String(userId))}`;

  const enqueueBody = {
    job_type: "daily_generate",
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
      headers: { "content-type": "application/json" },
      cache: "no-store",
    });
  } catch (err: any) {
    console.error("[Coach][apiGenerateDailyForWeek][run] ERROR", err);
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

  return {
    success: true,
    ...(result as any),
  };
}

export type DailyPlanStructure = {
  warmup?: { minutes?: number | null; notes?: string | null } | null;
  main?: any[] | null;
  cooldown?: { minutes?: number | null; notes?: string | null } | null;
  strength_exercises?: any[] | null;
};

export type DailyPlanSession = {
  id?: number | string | null;
  plan_date?: string;
  session_index?: number;
  sport: string;
  title: string | null;
  duration_min: number | null;
  intensity: string | null;
  notes: string | null;
  session_type?: string | null;
  structure?: DailyPlanStructure | null;
};

export type DailyPlanDay = {
  date: string;
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

export async function apiGetDailyOverview(
  userId: number
): Promise<DailyOverview | null> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/coach-plan-daily/overview/${encodeURIComponent(String(userId))}`;

  try {
    const json = await callBackend<DailyOverviewResponse>(path, {
      method: "GET",
      headers: { "content-type": "application/json" },
      cache: "no-store",
    });

    if (!json?.success) {
      throw new Error("api.coach.dailyLoadFailed");
    }

    return json.overview ?? null;
  } catch (err: any) {
    console.error("[Coach][apiGetDailyOverview] ERROR", err);
    throw new Error("api.coach.dailyLoadFailed");
  }
}

export type DailyRescheduleMove = {
  id: number | string;
  from_date: string;
  to_date: string;
};

type DailyRescheduleResponse = {
  success: boolean;
  overview: DailyOverview | null;
  detail?: string | null;
  error?: string | null;
};

export async function apiSaveDailyReschedule(
  userId: number,
  moves: DailyRescheduleMove[]
): Promise<DailyOverview | null> {
  if (!userId) throw new Error("api.common.missingUserAuth");
  if (!Array.isArray(moves) || moves.length === 0) return null;

  const path = `/coach-plan-daily/reschedule/${encodeURIComponent(String(userId))}`;

  try {
    const json = await callBackend<DailyRescheduleResponse>(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ moves }),
    });

    if (!json?.success) throw new Error("api.coach.dailyRescheduleFailed");
    return json.overview ?? null;
  } catch (err: any) {
    console.error("[Coach][apiSaveDailyReschedule] ERROR", err);
    throw new Error("api.coach.dailyRescheduleFailed");
  }
}