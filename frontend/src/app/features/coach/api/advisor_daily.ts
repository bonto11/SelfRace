// src/app/features/coach/api/advisor_daily.ts
import { callBackend } from "@/app/shared/utils/callBackend";
import type { DailyPlanSession } from "@/app/features/coach/api/coach_plan_daily";



export type ManualStrengthExercisePayload = {
  exercise_id: string;
  sets: number;
  reps: string;
};

export type ManualRunSessionType = "easy" | "recovery" | "long" | "tempo" | "interval";

export type IntervalUnit = "time" | "distance";

/** Druh inej aktivity / udalosti - hrubé rozdelenie pre AI. */
export type EventKind = "sport" | "work" | "social" | "chore" | "travel" | "other";

/** Náročnosť. Rovnaké stupne ako pri externých aktivitách v prefs. */
export type ActivityLoad = "easy" | "moderate" | "hard";

export const EVENT_KINDS: EventKind[] = [
  "sport",
  "work",
  "social",
  "chore",
  "travel",
  "other",
];

export const ACTIVITY_LOADS: ActivityLoad[] = ["easy", "moderate", "hard"];

/** Ktoré druhy sa štandardne rátajú do tréningového objemu. */
export function defaultCountsAsTraining(kind: EventKind): boolean {
  return kind === "sport";
}

export type ManualDailySessionCreatePayload = {
  plan_date: string;
  sport: "run" | "ride" | "swim" | "strength" | "other";
  title: string;
  duration_min: number;
  notes?: string | null;
  plan_meta_id?: number | null;

  session_type?: ManualRunSessionType | null;
  structure_mode?: "simple" | "intervals" | null;
  warmup_min?: number | null;
  warmup_notes?: string | null;
  cooldown_min?: number | null;
  cooldown_notes?: string | null;
  main_minutes?: number | null;
  main_notes?: string | null;

  rounds?: number | null;
  work_unit?: IntervalUnit | null;
  work_duration_s?: number | null;
  work_distance_m?: number | null;
  work_notes?: string | null;
  rest_unit?: IntervalUnit | null;
  rest_duration_s?: number | null;
  rest_distance_m?: number | null;
  rest_notes?: string | null;

  exercises?: ManualStrengthExercisePayload[] | null;

  // sport="other" - iná aktivita / udalosť
  event_kind?: EventKind | null;
  event_load?: ActivityLoad | null;
  counts_as_training?: boolean | null;
  event_description?: string | null;
};

/**
 * Chybový kód z BE -> i18n kľúč (advisorDaily.errors.*), aby ho FE vedel
 * preložiť cez t().
 */
function errorKey(json: any, fallback: string): string {
  const code = json?.error_code;
  return code ? `advisorDaily.errors.${code}` : fallback;
}

export async function apiStartManualPlan(
  userId: number,
  opts: { end_date?: string | null } = {}
): Promise<StartManualPlanResult> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/coach-plan-active/${encodeURIComponent(String(userId))}/start-manual`;

  try {
    const json = await callBackend<any>(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ end_date: opts.end_date || null }),
    });
    return {
      success: !!json?.success,
      error_code: json?.error_code ?? null,
      message: json?.message ?? null,
      plan_start: json?.plan_start ?? null,
      plan_end: json?.plan_end ?? null,
      meta: json?.meta ?? null,
    };
  } catch (err: any) {
    console.error("[Coach][apiStartManualPlan] ERROR", err);
    return { success: false, error_code: "REQUEST_FAILED", message: null };
  }
}


export async function apiCreateManualSession(
  userId: number,
  payload: ManualDailySessionCreatePayload
): Promise<DailyPlanSession> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/advisor-daily/session/${encodeURIComponent(String(userId))}`;

  let json: any;
  try {
    json = await callBackend<any>(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    console.error("[Coach][apiCreateManualSession] ERROR", err);
    throw new Error("advisorDaily.form.saveError");
  }

  if (!json?.success) {
    throw new Error(errorKey(json, "advisorDaily.form.saveError"));
  }
  return json.data as DailyPlanSession;
}

export async function apiUpdateManualSession(
  userId: number,
  sessionId: number,
  payload: ManualDailySessionUpdatePayload
): Promise<DailyPlanSession> {
  if (!userId || !sessionId) throw new Error("api.common.missingUserAuth");

  const path = `/advisor-daily/session/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(sessionId))}`;

  let json: any;
  try {
    json = await callBackend<any>(path, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    console.error("[Coach][apiUpdateManualSession] ERROR", err);
    throw new Error("advisorDaily.form.saveError");
  }

  if (!json?.success) {
    throw new Error(errorKey(json, "advisorDaily.form.saveError"));
  }
  return json.data as DailyPlanSession;
}

export async function apiDeleteManualSession(
  userId: number,
  sessionId: number
): Promise<void> {
  if (!userId || !sessionId) throw new Error("api.common.missingUserAuth");

  const path = `/advisor-daily/session/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(sessionId))}`;

  let json: any;
  try {
    json = await callBackend<any>(path, {
      method: "DELETE",
      cache: "no-store",
    });
  } catch (err: any) {
    console.error("[Coach][apiDeleteManualSession] ERROR", err);
    throw new Error("advisorDaily.errors.delete_failed");
  }

  if (!json?.success) {
    throw new Error(errorKey(json, "advisorDaily.errors.delete_failed"));
  }
}