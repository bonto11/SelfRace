// src/features/activities/types/activities.ts
export type StreamsData = {
  time_s: number[];
  hr: (number | null)[];

  // nové veci zo streams tabulky – všetko optional,
  // aby ti to nerozbilo starý kód
  cadence_rpm?: (number | null)[];
  power_w?: (number | null)[];
  distance_m?: (number | null)[];
  altitude_m?: (number | null)[]; // ⬅️ prevýšenie / nadmorská výška

  duration_s: number;
};

export type SportFE =
  | "run"
  | "ride"
  | "strength"
  | "mixed"
  | "skate"
  | "swim"
  | "other"
  | string;

export type Range = { start?: string; end?: string };

export type ComponentVariant = "activity" | "calendar" | "pb" | "plan";
export type Metric = "km" | "time" | "trimp";

export interface MiniActivity {
  id: number; // activity_id
  name: string; // napr. "Evening Run"
  start_date: string; // ISO "YYYY-MM-DDTHH:mm:ssZ" (alebo "YYYY-MM-DD")
  sport: SportFE; // z DB: sport_type_fe
  distance_km?: number | null;
  duration_min?: number | null;
}

export type WeekPick = {
  week: string;
  start: string;
  end: string;
  sport: string;
};

/** Ľahký rad pre listy/grafy (90d range) */
export type ActivityRow = {
  activity_id: number;
  name: string;
  date: string; // ISO "YYYY-MM-DD"

  // šport
  sport_type: string | null;
  sport_type_fe: SportFE | null;
  sport_type_ovrd: SportFE | null;

  // distance / time
  distance_m: number | null;
  moving_time_s: number | null;
  elapsed_time_s: number | null;

  // rýchlosť / tempo
  average_speed_mps: number | null;
  max_speed_mps: number | null;

  // tep
  average_heartrate_bpm: number | null;
  max_heartrate_bpm: number | null;

  // prevýšenie
  elevation_gain_m: number | null;
  elev_high_m: number | null;
  elev_low_m: number | null;

  // kadencia / teplota / výkon
  average_cadence_rpm: number | null;
  average_temp_c: number | null;
  average_watts: number | null;
  max_watts: number | null;

  // energia a štatistiky
  calories_kcal: number | null;
  achievement_count: number | null;
  pr_count: number | null;

  // výbava
  gear_id: string | null;
  gear_name: string | null;

  // časové info
  timezone: string | null;
  utc_offset_s: number | null;

  // extra polia z DB (aby mal SessionCard všetko)
  user_id: number | null;
  user_uid: string | null;
  description: string | null;
  comment: string | null;
  pace_seconds_per_km: number | null;
  deleted_at?: string | null;

  // workout / mapa
  workout_type: number | null;
  map_summary_polyline: string | null;
  map_polyline: string | null;

  // interné veci (zónový / AI enrichment)
  trimp: number | null;
};

/** Extra detail (doťahuje sa len na klik) */
export interface ActivityDetailExtra {
  laps: any[];
  splits: any[];
}

/** Týždenná agregácia pre grafy a summary */
export interface WeekRow {
  week: string; // "YYYY-Www"
  label: string; // napr. "1.–7.10."
  start: string; // ISO
  end: string; // ISO
  // km
  km_run: number;
  km_ride: number;
  km_mixed: number;
  km_skate: number;
  // time (min)
  time_run_min: number;
  time_ride_min: number;
  time_strength_min: number;
  time_mixed_min: number;
  time_skate_min: number;
  time_other_min: number;
  // trimp (ak nemáme, bude 0)
  trimp_run: number;
  trimp_ride: number;
  trimp_strength: number;
  trimp_mixed: number;
  trimp_skate: number;
  trimp_other: number;
  // monotony/strain pre každý metric
  monotony: { km?: number; time?: number; trimp?: number };
  strain: { km?: number; time?: number; trimp?: number };
}