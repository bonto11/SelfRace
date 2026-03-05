// src/features/coach/api/coach_plan_weekly.ts
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

export type WeeklyPlanGenerateOptions = {
  overwrite?: boolean;
  state_id?: number | null; 
  weeks?: number | null; 
};

export async function apiGenerateWeeklyPlan(
  userId: number,
  userUuid: string,
  opts: WeeklyPlanGenerateOptions = {}
): Promise<any> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const payload = {
    overwrite: opts.overwrite ?? true,
    state_id: opts.state_id ?? null,
    weeks: opts.weeks ?? null,
  };

  const enqueuePath = `/jobs/enqueue/${encodeURIComponent(String(userId))}`;

  const enqueueBody = {
    job_type: "weekly_generate",
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
    console.error("[Coach][apiGenerateWeeklyPlan][run] ERROR", err);
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
  weeks: WeeklyPlanWeek[];
};

type WeeklyPlanLatestResponse = {
  success: boolean;
  plan: WeeklyPlanLatest | null;
  detail?: string | null;
  error?: string | null;
};

export async function apiGetLatestWeeklyPlan(
  userId: number
): Promise<WeeklyPlanLatest | null> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/coach-plan-weekly/latest/${encodeURIComponent(String(userId))}`;

  try {
    const json = await callBackend<WeeklyPlanLatestResponse>(path, {
      method: "GET",
      headers: { "content-type": "application/json" },
      cache: "no-store",
    });

    if (!json?.success) {
      throw new Error("api.coach.weeklyLoadFailed");
    }

    return json.plan ?? null;
  } catch (err: any) {
    console.error("[Coach][apiGetLatestWeeklyPlan] ERROR", err);
    throw new Error("api.coach.weeklyLoadFailed");
  }
}