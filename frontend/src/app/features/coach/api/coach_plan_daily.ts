// src/features/coach/api/coach_plan_daily.ts
import { callBackend, runAsyncJobWithPolling } from "@/app/shared/utils/callBackend";

export type DailyWeekGenerateOptions = {
  week_index: number;
  overwrite?: boolean;
};

export async function apiGenerateDailyForWeek(
  userId: number,
  userUuid: string,
  opts: DailyWeekGenerateOptions
): Promise<{ success: boolean; status?: string; error_code?: string; message?: string; data?: any }> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const enqueuePath = `/jobs/enqueue/${encodeURIComponent(String(userId))}`;
  const enqueueBody = {
    job_type: "daily_generate",
    payload: {
      week_index: opts.week_index,
      overwrite: opts.overwrite ?? true,
      debug: true,
    },
    priority: 100,
    max_attempts: 1,
    dedupe_key: `daily_generate_week_${opts.week_index}`,
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
    console.error("[Coach][apiGenerateDailyForWeek][enqueue] ERROR", err);
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
  status?: "planned" | "done" | "postponed" | "missed";
  activity_id?: number | null;
};

export type DailyPlanDay = {
  date: string;
  sessions: DailyPlanSession[];
};

export type DailyOverview = {
  horizon_days: number;
  days: DailyPlanDay[];
};

export async function apiGetDailyOverview(userId: number): Promise<DailyOverview | null> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/coach-plan-daily/overview/${encodeURIComponent(String(userId))}`;

  try {
    const json = await callBackend<any>(path, {
      method: "GET",
      headers: { "content-type": "application/json" },
      cache: "no-store",
    });

    if (!json?.success) return null;
    return json.data || json.overview || null;
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

export async function apiSaveDailyReschedule(
  userId: number,
  moves: DailyRescheduleMove[]
): Promise<DailyOverview | null> {
  if (!userId) throw new Error("api.common.missingUserAuth");
  if (!Array.isArray(moves) || moves.length === 0) return null;

  const path = `/coach-plan-daily/reschedule/${encodeURIComponent(String(userId))}`;

  try {
    const json = await callBackend<any>(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ moves }),
    });

    if (!json?.success) throw new Error("api.coach.dailyRescheduleFailed");
    return json.data || json.overview || null;
  } catch (err: any) {
    console.error("[Coach][apiSaveDailyReschedule] ERROR", err);
    throw new Error("api.coach.dailyRescheduleFailed");
  }
}

export type PatchDailySessionPayload = {
  status?: "planned" | "done" | "postponed" | "missed";
  activity_id?: number | null;
  unmatch?: boolean;
};

export async function apiPatchDailySessionStatus(
  userId: number,
  sessionId: number,
  payload: PatchDailySessionPayload
): Promise<DailyPlanSession | null> {
  if (!userId || !sessionId) throw new Error("api.common.missingUserAuth");

  const path = `/coach-plan-daily/session/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(sessionId))}`;

  try {
    const json = await callBackend<any>(path, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
    });

    if (!json?.success) throw new Error("api.coach.dailyUpdateFailed");
    return json.data || null;
  } catch (err: any) {
    console.error("[Coach][apiPatchDailySessionStatus] ERROR", err);
    throw new Error("api.coach.dailyUpdateFailed");
  }
}

export async function apiGetPlanCompliance(userId: number): Promise<any> {
  const path = `/coach-plan-daily/compliance/${encodeURIComponent(String(userId))}`;
  const json = await callBackend<any>(path, { method: "GET" });
  return json?.success ? json.data : null;
}

/* ─── STREAK ─── */
export type SportStat = {
  time_s: number;
  dist_m: number | null;
};

export type StreakData = {
  current_streak: number;
  best_streak: number;
  this_week_done: number;
  min_sessions_per_week: number;
  min_duration_min: number;
  sport_stats: Record<string, SportStat>;
};

export async function apiGetStreak(userId: number): Promise<StreakData | null> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/coach-plan-daily/${encodeURIComponent(String(userId))}/coach-streak`;

  try {
    const json = await callBackend<any>(path, {
      method: "GET",
      cache: "no-store",
    });
    return json?.success ? (json.data as StreakData) : null;
  } catch (err: any) {
    console.error("[Coach][apiGetStreak] ERROR", err);
    return null;
  }
}