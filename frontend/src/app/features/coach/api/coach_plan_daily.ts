// src/features/coach/api/coach_plan_daily.ts
import { callBackend, runAsyncJobWithPolling } from "@/app/shared/utils/callBackend";

export type DailyWeekGenerateOptions = {
  week_index: number;
  overwrite?: boolean;
  plan_meta_id?: number | null;
  drop_past_days?: boolean;
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
      // 🌟 plan_meta_id sa musí posielať explicitne z FE - ak sme práve
      // vygenerovali nový draft (weekly_generate vrátil plan_meta_id), ten
      // draft ešte NIE JE aktívny, takže backend by si ho sám cez "aktívny
      // plán" nikdy nenašiel a daily riadky by dostali NULL.
      plan_meta_id: opts.plan_meta_id ?? null,
      // 🌟 FIX: bez tohto sa pri regenerovaní v strede týždňa prepíšu aj
      // už odtrénované dni (pondelok/utorok atď.) niečím, čo si AI vymyslí
      // naslepo. drop_past_days zabezpečí, že sa dotknú len dni od
      // dnešného dátumu ďalej.
      drop_past_days: opts.drop_past_days ?? false,
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

// 🌟 NOVÉ: manuálne vyvolanie "continue" mechanizmu (rovnaký job, aký beží
// automaticky po synchronizácii aktivity - service_auto_extend_daily_plan).
// Ak zostáva menej dní než min_horizon_days (backend default z
// COACH_PLAN_GENERATE_MIN_HORIZON_DAYS), dogeneruje ďalší potrebný
// week_index. Ak horizont stačí, vráti sa bez zmeny (changed: false) -
// bezpečné volať "na skusku" po každom manuálnom replane aktuálneho týždňa.
export async function apiExtendDailyPlan(
  userId: number,
  opts: { min_horizon_days?: number } = {}
): Promise<{ success: boolean; status?: string; error_code?: string; message?: string; data?: any }> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const enqueuePath = `/jobs/enqueue/${encodeURIComponent(String(userId))}`;
  const enqueueBody = {
    job_type: "daily_extend",
    payload: {
      ...(opts.min_horizon_days ? { min_horizon_days: opts.min_horizon_days } : {}),
    },
    priority: 90,
    max_attempts: 1,
    dedupe_key: `daily_extend:${userId}`,
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
    console.error("[Coach][apiExtendDailyPlan][enqueue] ERROR", err);
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

export async function apiSessionPreviewAsk(
  userId: number, sessionId: number, comment: string, requestChange: boolean,
) {
  const path = `/coach-plan-daily/session/${userId}/${sessionId}/preview-ask`;
  return callBackend<any>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ comment, request_change: requestChange }),
  });
}

export async function apiGetPlanByActivityId(
  userId: number,
  activityId: number
): Promise<DailyPlanSession | null> {
  if (!userId || !activityId) return null;

  const path = `/coach-plan-daily/by-activity/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(activityId))}`;

  try {
    const json = await callBackend<any>(path, {
      method: "GET",
      cache: "no-store",
    });
    return json?.success ? (json.data as DailyPlanSession | null) : null;
  } catch (err: any) {
    console.error("[Coach][apiGetPlanByActivityId] ERROR", err);
    return null;
  }
}

// 🌟 NOVÉ: kombinovaná operácia "Uprav dni" - regeneruje aktuálny týždeň
// (bez zásahu do minulosti) A hneď nato skontroluje horizont, prípadne
// dogeneruje aj ďalší týždeň. Ephemeral poznámka sa spotrebuje až na konci
// celého reťazca, takže platí pre všetko, čo sa v rámci tohto volania
// vygeneruje - nie len pre prvý (aktuálny) týždeň.
export type ReplanDailyAndExtendOptions = {
  week_index: number;
  plan_meta_id?: number | null;
  min_horizon_days?: number;
};

export async function apiReplanDailyAndExtend(
  userId: number,
  userUuid: string,
  opts: ReplanDailyAndExtendOptions
): Promise<{ success: boolean; status?: string; error_code?: string; message?: string; data?: any }> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const enqueuePath = `/jobs/enqueue/${encodeURIComponent(String(userId))}`;
  const enqueueBody = {
    job_type: "daily_replan_and_extend",
    payload: {
      week_index: opts.week_index,
      plan_meta_id: opts.plan_meta_id ?? null,
      ...(opts.min_horizon_days ? { min_horizon_days: opts.min_horizon_days } : {}),
    },
    priority: 100,
    max_attempts: 1,
    dedupe_key: `daily_replan_and_extend_week_${opts.week_index}`,
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
    console.error("[Coach][apiReplanDailyAndExtend][enqueue] ERROR", err);
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

