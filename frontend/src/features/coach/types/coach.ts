// src/features/coach/types/coach.ts
export type typePB = {
  distance_m: number;        // 400 | 1000 | 5000 | 21097 | 42195
  best_time_s?: number | null;
  time_str?: string | null;  // "hh:mm:ss" (len pre FE)
  event_name?: string | null;
  date?: string | null;      // "YYYY-MM-DD"
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
  // doplníš, ak bude treba
};