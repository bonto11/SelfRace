// src/app/features/activities/api/exercise_suggestions.ts
import { callBackend } from "@/app/shared/utils/callBackend";

export type ExerciseSuggestionPayload = {
  name: string;
  pattern: string;
  load_mode: "external" | "bodyweight_plus";
  measure: "reps" | "time" | "distance";
  equipment: string[];
  notes?: string | null;
};

export async function apiSuggestExercise(
  userId: number,
  payload: ExerciseSuggestionPayload,
): Promise<boolean> {
  if (!userId) return false;
  try {
    const json = await callBackend<any>(
      `/exercise-suggestions/${encodeURIComponent(String(userId))}`,
      {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    return !!json?.success;
  } catch (e) {
    console.error("[ExerciseSuggestion] create error", e);
    return false;
  }
}
