// shared/types/activities
export type SportFE = "run" | "ride" | "swim" | "strength" | "mixed" | string;

export interface MiniActivity {
  id: number;                 // activity_id
  name: string;               // napr. "Evening Run"
  start_date: string;         // ISO "YYYY-MM-DDTHH:mm:ssZ" (alebo "YYYY-MM-DD")
  sport: SportFE;             // z DB: sport_type_fe
  distance_km?: number | null;
  duration_min?: number | null;
}