// src/features/coach/api/coach_plan_weekly.ts
import { callBackend, runAsyncJobWithPolling } from "@/app/shared/utils/callBackend";

export type WeeklyPlanGenerateOptions = {
  overwrite?: boolean;
  state_id?: number | null; 
  weeks?: number | null; 
};

export async function apiGenerateWeeklyPlan(
  userId: number,
  userUuid: string,
  opts: WeeklyPlanGenerateOptions = {}
): Promise<{
  success: boolean;
  status?: string;
  error_code?: string;
  message?: string;
  data?: any;
  coach_reply?: string | null;
}> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const enqueuePath = `/jobs/enqueue/${encodeURIComponent(String(userId))}`;
  const enqueueBody = {
    job_type: "weekly_generate",
    payload: {
      overwrite: opts.overwrite ?? true,
      state_id: opts.state_id ?? null,
      weeks: opts.weeks ?? null,
    },
    priority: 100,
    max_attempts: 1,
    dedupe_key: "weekly_generate_latest",
  };

  let enqueueJson: any;
  try {
    enqueueJson = await callBackend(enqueuePath, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(enqueueBody),
    });
  } catch (err: any) {
    console.error("[Coach][apiGenerateWeeklyPlan][enqueue] ERROR", err);
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

  const pollResult = await runAsyncJobWithPolling(userId, jobId);

  // 🌟 coach_reply je súčasť service_generate_weekly_plan response (resp.coach_reply),
  // ktoré sa dostane sem cez job.result -> data. runAsyncJobWithPolling ho vracia
  // v poli 'data', vyťahujeme ho na top-level pre jednoduchší prístup na FE.
  const coachReply =
    pollResult?.data?.coach_reply ??
    pollResult?.data?.result?.coach_reply ??
    null;

  return { ...pollResult, coach_reply: coachReply };
}

// ... (Zvyšok tvojho súboru, napr. apiGetLatestWeeklyPlan a typy, ostáva rovnaký ako si poslal) ...
export type WeeklyPlanWeek = {
  week_index: number;
  week_start: string | null;
  week_end: string | null;
  goal?: string | null;
  focus?: string | null;
  load_phase?: string | null;
  planned_stats?: Record<string, number> | null; 
  actual_stats?: Record<string, number> | null;  
  notes?: string | null;
  raw_json?: any;
};

export type WeeklyPlanLatest = {
  weeks: WeeklyPlanWeek[];
};

export async function apiGetLatestWeeklyPlan(userId: number): Promise<WeeklyPlanLatest | null> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/coach-plan-weekly/latest/${encodeURIComponent(String(userId))}`;

  try {
    const json = await callBackend<any>(path, {
      method: "GET",
      headers: { "content-type": "application/json" },
      cache: "no-store",
    });

    if (!json?.success) {
      return null;
    }

    return json.data || json.plan || null;
  } catch (err: any) {
    console.error("[Coach][apiGetLatestWeeklyPlan] ERROR", err);
    throw new Error("api.coach.weeklyLoadFailed");
  }
}
