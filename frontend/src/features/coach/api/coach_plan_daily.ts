// src/features/coach/api/coach_plan_daily.ts
import { API_URL } from "@/shared/config";
import { robustJson } from "@/features/coach/api/_api_utils";

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
};

type RunJobResponse = {
  success: boolean;
  job: AsyncJobRow | null;
};

/* ============ typy ============ */

export type DailyWeekGenerateOptions = {
  week_index: number; // 1-based index v weekly pláne
  plan_id?: string | null; // ak null → posledný aktívny plán
  overwrite?: boolean;
};

/* ============ GENERATE WEEK (coach-plan-daily) ============ */

/**
 * POST /coach-plan-daily/generate/{user_id}
 * NOVO: ide cez async_jobs (job_type = "daily_generate")
 */
export async function apiGenerateDailyForWeek(
  userId: number,
  userUuid: string, 
  opts: DailyWeekGenerateOptions
): Promise<any> {
  if (!API_URL) throw new Error("API_URL is not configured");
  if (!opts || typeof opts.week_index !== "number") {
    throw new Error("week_index is required for apiGenerateDailyForWeek");
  }

  const payload = {
    week_index: opts.week_index,
    plan_id: opts.plan_id ?? null,
    overwrite: opts.overwrite ?? true,
  };

  // 1) ENQUEUE JOB
  const enqueueUrl = `${API_URL}/jobs/enqueue/${userId}`;

  const enqueueBody = {
    job_type: "daily_generate",
    user_uuid: userUuid,
    payload,
    priority: 100,
    max_attempts: 1,
    dedupe_key: `daily_generate_week_${opts.week_index}`,
  };

  const enqueueRes = await fetch(enqueueUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(enqueueBody),
  }).catch((err) => {
    throw new Error(`Network/CORS (enqueue daily): ${String(err)}`);
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

  // 2) RUN JOB TERAZ
  const runUrl = `${API_URL}/jobs/run/${userId}/${jobId}`;

  const runRes = await fetch(runUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
  }).catch((err) => {
    throw new Error(`Network/CORS (run daily): ${String(err)}`);
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
    throw new Error("Daily job finished but result payload is empty or invalid");
  }

  return {
    success: true,
    ...(result as any),
  };
}

/* ---- STARÁ priama verzia (ponechaná ako komentár) ----
export async function apiGenerateDailyForWeek(
  userId: number,
  opts: DailyWeekGenerateOptions
): Promise<any> {
  if (!API_URL) throw new Error("API_URL is not configured");
  if (!opts || typeof opts.week_index !== "number") {
    throw new Error("week_index is required for apiGenerateDailyForWeek");
  }

  const payload = {
    week_index: opts.week_index,
    plan_id: opts.plan_id ?? null,
    overwrite: opts.overwrite ?? true,
  };

  const res = await fetch(`${API_URL}/coach-plan-daily/generate/${userId}`, {
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

/* ============ DAILY OVERVIEW (coach-plan-daily) – BEZ ZMENY ============ */

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
};

/**
 * GET /coach-plan-daily/overview/{user_id}
 */
export async function apiGetDailyOverview(
  userId: number
): Promise<DailyOverview | null> {
  if (!API_URL) throw new Error("API_URL is not configured");

  const res = await fetch(`${API_URL}/coach-plan-daily/overview/${userId}`, {
    method: "GET",
    headers: { "content-type": "application/json" },
    cache: "no-store",
  }).catch((err) => {
    throw new Error(`Network/CORS: ${String(err)}`);
  });

  const json = (await robustJson(res)) as DailyOverviewResponse;

  if (!res.ok || json?.success === false) {
    throw new Error(
      (json as any)?.detail || (json as any)?.error || `HTTP ${res.status}`
    );
  }

  return json.overview ?? null;
}