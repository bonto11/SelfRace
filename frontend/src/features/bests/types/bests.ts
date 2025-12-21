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

export type PBRow = {
  distanceKm: number;
  best: string;
  activityId?: number | null;
  date?: string | null;
};

// jeden typ pre položku
export type DistanceOption = { m: number; label: string };

export type PBRunFormState = {
  distance_m: string;
  time_str: string; // hh:mm:ss
  achieved_at: string; // YYYY-MM-DD
  activity_id: string; // "" alebo číslo v texte
  activity_name?: string;
};