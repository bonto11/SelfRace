export type RecoveryRow = {
  date: string;
  RHR_bpm: number | null;
  HRV_avg_ms: number | null;
  HRV_max_ms: number | null;
  sleep_start_time: string | null;
  sleep_duration_min: number | null;
  comments: string | null;

  caffeine_8h: boolean;
  food_2h_before: boolean;
  alcohol_consumed: boolean;
};

export type RecoveryPatch = {
  user_id: number;
  date: string;

  RHR_bpm?: number | null;
  HRV_avg_ms?: number | null;
  HRV_max_ms?: number | null;
  sleep_start_time?: string | null;
  sleep_duration_min?: number | null;

  food_2h_before?: boolean;
  caffeine_8h?: boolean;
  alcohol_consumed?: boolean;

  comments?: string | null;
};
