// src/app/features/strength/api/strength_sessions.ts
import { callBackend } from "@/app/shared/utils/callBackend";

export type StrengthBlock = "activation" | "strength_main_part" | "add_ons";

export type StrengthSetEntry = {
  set_index: number;
  weight_kg: number | null;
  reps: number | null;
  rpe: number | null;
  is_warmup: boolean;
  done_at?: string;
};

export type StrengthExerciseLog = {
  exercise_id: string;
  block: StrengthBlock;
  order_index: number;
  planned: { sets?: number | null; reps?: string | null; rest_s?: number | null } | null;
  sets: StrengthSetEntry[];
};

export type StrengthSession = {
  id: number;
  user_id: number;
  session_date: string;
  plan_session_id: number | null;
  activity_id: number | null;
  title: string | null;
  log: { version: number; exercises: StrengthExerciseLog[] };
  completed: boolean;
  session_note: string | null;
  created_at: string;
  updated_at: string;
};

export type ExerciseProgressionEntry = {
  date: string;
  sets_done: number;
  top_weight_kg: number | null;
  top_reps: number | null;
  volume_kg: number;
  avg_rpe: number | null;
};

const base = (userId: number) => `/strength-sessions/${encodeURIComponent(String(userId))}`;

export async function apiCreateStrengthSession(
  userId: number,
  opts: {
    session_date?: string | null;
    title?: string | null;
    plan_session_id?: number | null;
    activity_id?: number | null;
  } = {},
): Promise<StrengthSession | null> {
  if (!userId) return null;
  try {
    const json = await callBackend<any>(base(userId), {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_date: opts.session_date ?? null,
        title: opts.title ?? null,
        plan_session_id: opts.plan_session_id ?? null,
        activity_id: opts.activity_id ?? null,
      }),
    });
    return json?.success ? (json.data as StrengthSession) : null;
  } catch (e) {
    console.error("[StrengthSessions] create error", e);
    return null;
  }
}

export async function apiGetStrengthSession(
  userId: number,
  sessionId: number,
): Promise<StrengthSession | null> {
  if (!userId || !sessionId) return null;
  try {
    const json = await callBackend<any>(`${base(userId)}/${sessionId}`, {
      method: "GET",
      cache: "no-store",
    });
    return json?.success ? (json.data as StrengthSession) : null;
  } catch (e) {
    console.error("[StrengthSessions] get error", e);
    return null;
  }
}

export async function apiGetStrengthSessionByPlan(
  userId: number,
  planSessionId: number,
): Promise<StrengthSession | null> {
  if (!userId || !planSessionId) return null;
  try {
    const json = await callBackend<any>(`${base(userId)}/by-plan/${planSessionId}`, {
      method: "GET",
      cache: "no-store",
    });
    return json?.success ? ((json.data as StrengthSession) ?? null) : null;
  } catch (e) {
    console.error("[StrengthSessions] by-plan error", e);
    return null;
  }
}

export async function apiListStrengthSessions(
  userId: number,
  opts: { weeks_back?: number; limit?: number } = {},
): Promise<StrengthSession[]> {
  if (!userId) return [];
  const qs = new URLSearchParams();
  if (opts.weeks_back) qs.set("weeks_back", String(opts.weeks_back));
  if (opts.limit) qs.set("limit", String(opts.limit));
  try {
    const json = await callBackend<any>(`${base(userId)}?${qs.toString()}`, {
      method: "GET",
      cache: "no-store",
    });
    return json?.success && Array.isArray(json.data) ? json.data : [];
  } catch (e) {
    console.error("[StrengthSessions] list error", e);
    return [];
  }
}

export async function apiUpdateStrengthSession(
  userId: number,
  sessionId: number,
  patch: {
    exercises?: StrengthExerciseLog[];
    completed?: boolean;
    session_note?: string | null;
    session_date?: string;
    title?: string | null;
  },
): Promise<StrengthSession | null> {
  if (!userId || !sessionId) return null;
  try {
    const json = await callBackend<any>(`${base(userId)}/${sessionId}`, {
      method: "PUT",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    return json?.success ? (json.data as StrengthSession) : null;
  } catch (e) {
    console.error("[StrengthSessions] update error", e);
    return null;
  }
}

export async function apiDeleteStrengthSession(
  userId: number,
  sessionId: number,
): Promise<boolean> {
  if (!userId || !sessionId) return false;
  try {
    const json = await callBackend<any>(`${base(userId)}/${sessionId}`, {
      method: "DELETE",
      cache: "no-store",
    });
    return !!json?.success;
  } catch (e) {
    console.error("[StrengthSessions] delete error", e);
    return false;
  }
}

export async function apiGetExerciseProgression(
  userId: number,
  exerciseId: string,
  weeksBack = 12,
): Promise<ExerciseProgressionEntry[]> {
  if (!userId || !exerciseId) return [];
  try {
    const json = await callBackend<any>(
      `${base(userId)}/progression/${encodeURIComponent(exerciseId)}?weeks_back=${weeksBack}`,
      { method: "GET", cache: "no-store" },
    );
    return json?.success && Array.isArray(json.data?.history) ? json.data.history : [];
  } catch (e) {
    console.error("[StrengthSessions] progression error", e);
    return [];
  }
}

/* ─── IMPORT Z PLÁNU ─── */

export type PlannedStrengthSession = {
  id: number;
  plan_date: string;
  title: string | null;
  exercise_count: number;
};

/**
 * Nedávne naplánované silové tréningy (coach_plan_daily, sport='strength'),
 * z ktorých sa dá naimportovať kostra cvikov do zápisu.
 */
export async function apiListPlannedStrengthSessions(
  userId: number,
  opts: { days_back?: number; days_forward?: number } = {},
): Promise<PlannedStrengthSession[]> {
  if (!userId) return [];
  const qs = new URLSearchParams();
  qs.set("days_back", String(opts.days_back ?? 14));
  qs.set("days_forward", String(opts.days_forward ?? 7));
  try {
    const json = await callBackend<any>(
      `${base(userId)}/planned-sessions?${qs.toString()}`,
      { method: "GET", cache: "no-store" },
    );
    return json?.success && Array.isArray(json.data) ? json.data : [];
  } catch (e) {
    console.error("[StrengthSessions] planned list error", e);
    return [];
  }
}

/**
 * Naimportuje cviky z naplánovanej session do existujúceho zápisu.
 * Prepíše aktuálne cviky (user je na to upozornený v UI).
 */
export async function apiImportFromPlan(
  userId: number,
  sessionId: number,
  planSessionId: number,
): Promise<StrengthSession | null> {
  if (!userId || !sessionId || !planSessionId) return null;
  try {
    const json = await callBackend<any>(
      `${base(userId)}/${sessionId}/import-from-plan`,
      {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_session_id: planSessionId }),
      },
    );
    return json?.success ? (json.data as StrengthSession) : null;
  } catch (e) {
    console.error("[StrengthSessions] import error", e);
    return null;
  }
}
