// src/app/features/coach/api/coach_strength_log.ts
import { callBackend } from "@/app/shared/utils/callBackend";

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
  block: "activation" | "strength_main_part" | "add_ons" | "main_part";
  order_index: number;
  planned: { sets?: number | null; reps?: string | null; rest_s?: number | null } | null;
  sets: StrengthSetEntry[];
};

export type StrengthLog = {
  version: number;
  updated_at: string;
  completed: boolean;
  session_note: string | null;
  exercises: StrengthExerciseLog[];
};

export type ExerciseProgressionEntry = {
  date: string;
  sets_done: number;
  top_weight_kg: number | null;
  top_reps: number | null;
  avg_rpe: number | null;
};

export async function apiGetStrengthLog(
  userId: number,
  sessionId: number,
): Promise<StrengthLog | null> {
  if (!userId || !sessionId) return null;
  const path = `/coach-strength-log/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(sessionId))}`;
  try {
    const json = await callBackend<any>(path, { method: "GET", cache: "no-store" });
    return json?.success ? (json.data as StrengthLog) : null;
  } catch (e) {
    console.error("[StrengthLog] fetch error", e);
    return null;
  }
}

export async function apiSaveStrengthLog(
  userId: number,
  sessionId: number,
  payload: { exercises: StrengthExerciseLog[]; completed?: boolean; session_note?: string | null },
): Promise<StrengthLog | null> {
  if (!userId || !sessionId) return null;
  const path = `/coach-strength-log/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(sessionId))}`;
  try {
    const json = await callBackend<any>(path, {
      method: "PUT",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exercises: payload.exercises,
        completed: payload.completed ?? false,
        session_note: payload.session_note ?? null,
      }),
    });
    return json?.success ? (json.data as StrengthLog) : null;
  } catch (e) {
    console.error("[StrengthLog] save error", e);
    return null;
  }
}

export async function apiGetExerciseProgression(
  userId: number,
  exerciseId: string,
  weeksBack = 8,
): Promise<ExerciseProgressionEntry[]> {
  if (!userId || !exerciseId) return [];
  const path = `/coach-strength-log/${encodeURIComponent(String(userId))}/progression/${encodeURIComponent(exerciseId)}?weeks_back=${weeksBack}`;
  try {
    const json = await callBackend<any>(path, { method: "GET", cache: "no-store" });
    return json?.success && Array.isArray(json.data?.history) ? json.data.history : [];
  } catch (e) {
    console.error("[StrengthLog] progression error", e);
    return [];
  }
}