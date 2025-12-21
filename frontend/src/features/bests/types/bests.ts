export type Sport = "run" | "ride" | "strength" | "skate" | "swim";

export type UserBest = {
  sport?: Sport;
  distance_m: number;
  best_time_s?: number | null;
  time_str?: string | null;
  activity_id?: number | null;
  activity_name?: string | null;
  achieved_at?: string | null; // YYYY-MM-DD alebo ISO
};

export type typePB = {
  distance_m: number;
  best_time_s?: number | null;
  time_str?: string | null;
  event_name?: string | null;
  date?: string | null;
};