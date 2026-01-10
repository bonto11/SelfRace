export type StreamsData = {
  time_s: number[];
  hr: (number | null)[];

  // nové veci zo streams tabulky – všetko optional,
  // aby ti to nerozbilo starý kód
  cadence_rpm?: (number | null)[];
  power_w?: (number | null)[];
  distance_m?: (number | null)[];

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
  id: number;                 // activity_id
  name: string;               // napr. "Evening Run"
  start_date: string;         // ISO "YYYY-MM-DDTHH:mm:ssZ" (alebo "YYYY-MM-DD")
  sport: SportFE;             // z DB: sport_type_fe
  distance_km?: number | null;
  duration_min?: number | null;
}

export type WeekPick = { week: string; start: string; end: string; sport: string };

/** Ľahký rad pre listy/grafy (90d range) */
export interface ActivityRow {
  activity_id: number;
  name: string;
  date: string; // ISO (YYYY-MM-DD)
  sport_type?: string | null;
  sport_type_fe?: string | null;
  sport_type_ovrd?: string | null;
  distance_m: number | null;
  moving_time_s: number | null;
  average_heartrate_bpm: number | null;
  max_heartrate_bpm: number | null;
  // voliteľne – ak by API niekde malo TRIMP (ak nie, nechávame null)
  trimp: number | null;
}

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