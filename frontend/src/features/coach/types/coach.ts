// src/features/coach/types/coach.ts
export type typePB = {
  distance_m: number;
  best_time_s?: number | null;
  time_str?: string | null;
  event_name?: string | null;
  date?: string | null;
};

export type CoachPrefsLegacyLoose = {
  goal_kind?: string;
  goal_distance_km?: number | null;
  current_pace?: string | null;
  target_pace?: string | null;
  weeks?: number | null;
  sports?: string[];
  notes?: string | null;
  other?: Record<string, unknown>;
};