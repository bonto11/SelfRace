// src/features/coach/api/coach_plan_daily.ts
import { callBackend } from "@/app/shared/utils/callBackend";

export type DailyWeekGenerateOptions = {
  week_index: number;
  overwrite?: boolean;
};

// ✅ OPRAVA: Konzistentný Response Type
export async function apiGenerateDailyForWeek(
  userId: number,
  userUuid: string,
  opts: DailyWeekGenerateOptions
): Promise<{ success: boolean; status?: string; error_code?: string; message?: string; data?: any }> {
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

  const runPath = `/jobs/run/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(jobId))}`;

  let runJson: any;
  try {
    runJson = await callBackend(runPath, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
    });
  } catch (err: any) {
    console.error("[Coach][apiGenerateDailyForWeek][run] ERROR", err);
    return { success: false, error_code: "REQUEST_FAILED", message: "Network error" };
  }

  if (!runJson?.success) {
    console.warn("[Coach] Sync Run HTTP Failed", runJson);
    return { success: true, status: "PROCESSING" };
  }

  // ✅ NOVÉ: Pozrieme sa dovnútra Jobu (výsledok z Workera)
  const innerResult = runJson.job?.result || runJson.data?.result || runJson.result;
  
  if (innerResult && innerResult.ok === false) {
    return {
      success: false,
      error_code: innerResult.code || "ai_generation_failed",
      message: innerResult.message
    };
  }

  const jobStatus = runJson.job?.status || runJson.data?.status || runJson.status;
  if (jobStatus === "failed" || jobStatus === "error") {
    return {
      success: false,
      error_code: "ai_generation_failed",
      message: "Úloha na pozadí zlyhala."
    };
  }

  return {
    success: true,
    status: "SUCCESS",
    data: innerResult
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

export async function apiGetDailyOverview(userId: number): Promise<DailyOverview | null> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/coach-plan-daily/overview/${encodeURIComponent(String(userId))}`;

  try {
    const json = await callBackend<any>(path, {
      method: "GET",
      headers: { "content-type": "application/json" },
      cache: "no-store",
    });

    if (!json?.success) {
      return null;
    }

    // Backend posiela dáta v json.data alebo priamo json.overview
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