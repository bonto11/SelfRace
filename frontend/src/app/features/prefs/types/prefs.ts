import type { DayAbbrev } from "@/app/shared/types/day";

/** Hlavné ciele plánu / tréningu */
export type GoalKind = "improve_speed" | "improve_endurance" | "improve_overall" | "maintain";

/** Podporované športy v coach prefs. */
export type SportKind = "run" | "ride" | "swim";

export type SecondaryRole = "none" | "supplement" | "improve";

export type SecondaryMix = {
  sport: SportKind;
  role: SecondaryRole;
  share_pct: number;
};

export interface WomensHealth {
  sync_enabled: boolean;
  cycle_length_days?: number;
  next_cycle_start?: string | null;
}

export type VolumeMode = "weekly_hours" | "daily_minutes";

export type VolumePrefs = {
  mode: VolumeMode;
  value: number | null;
};

/** Coach personality (EN) + custom; allow null for "none selected". */
export type CoachPersona =
  | "drill_sergeant"
  | "motivator"
  | "analyst"
  | "realist"
  | "custom";

export type RacePriority = "A" | "B" | "C";

/* -------- Race meta -------- */

export type RaceDistanceKind =
  | "5k"
  | "10k"
  | "half"
  | "marathon"
  | "ultra"
  | "other";

export type RaceType = "road" | "trail" | "track" | "cross" | "ocr" | "other";
export type RaceTerrain = "flat" | "rolling" | "hilly" | "mountain";
export type RaceElevationProfile = "low" | "moderate" | "high";

/* -------- Zones & Thresholds -------- */
export type ZoneCalcMode = "manual" | "hrmax" | "percent_lthr" | "default";

export type Zones = {
  hr_max?: number | null;
  z1_min?: number | null;
  z1_max?: number | null;
  z2_min?: number | null;
  z2_max?: number | null;
  z3_min?: number | null;
  z3_max?: number | null;
  z4_min?: number | null;
  z4_max?: number | null;
  z5_min?: number | null;
  z5_max?: number | null;
};

export type Thresholds = {
  sport?: "running" | "cycling" | "other" | string | null;
  hr_bpm?: number | null;
  pace_sec_km?: number | null;
  power_watt?: number | null;
  threshold_type?:
    | "LT1"
    | "LT2"
    | "FTP"
    | "HR_LT2"
    | "PACE_LT2"
    | string
    | null;
  measurement_type?:
    | "lab test"
    | "field test"
    | "estimate garmin"
    | "estimate strava"
    | "coach estimate"
    | "other"
    | string
    | null;
  updated_at?: string | null;
};

/* -------- Targets -------- */

export interface RunRaceTarget {
  id?: string;
  name?: string | null;
  date?: string | null;
  priority?: RacePriority | null;
  race_goal?: RaceDistanceKind | null;
  custom_distance_km?: number | null;
  target_time?: string | null;
  race_type?: RaceType | null;
  terrain?: RaceTerrain | null;
  elevation_profile?: RaceElevationProfile | null;
  elevation_gain_m?: number | null;
}

export interface RunTargets {
  races?: RunRaceTarget[];
  race_goal: RaceDistanceKind | null;
  custom_distance_km?: number | null;
  current_best_time: string | null;
  target_time: string | null;
  longest_recent_distance_km: number | null;
  priority?: RacePriority | null;
  race_type?: RaceType | null;
  terrain?: RaceTerrain | null;
  elevation_profile?: RaceElevationProfile | null;
}

export interface BikeTargets {
  focus: "endurance" | "ftp" | "vo2";
  weekly_time_target_min: number | null;
}

export interface StrengthTargets {
  focus: "general" | "hypertrophy" | "max_strength";
  sessions_per_week: number;
}

/** Swim targets */
export interface SwimTargets {
  focus: "technique" | "endurance" | "speed" | "open_water";
  weekly_time_target_min: number | null;
  sessions_per_week?: number | null;
}


/* -------- strength settings -------- */

export type StrengthLocation = "gym" | "home" | "outdoor";
export type StrengthEquipmentMode = "none" | "bodyweight" | "minimal" | "full_gym";

export type StrengthEquipmentKey =
  | "dumbbells"
  | "barbell"
  | "kettlebell"
  | "trx"
  | "pullup_bar"
  | "resistance_bands"
  | "bench"
  | "medicine_ball"
  | "sandbag"
  | "box"
  | "abwheel"
  | "other";

export type StrengthSettings = {
  location?: StrengthLocation | null;
  equipment_mode?: StrengthEquipmentMode | null;
  available?: StrengthEquipmentKey[];
  sessions_per_week?: number | null;
};

/* -------- rules -------- */

export type TwoADayPrefs = {
  enabled: boolean;
  max_days_per_week: number; // 0..2
};

export type IntensityModel = "polarized" | "pyramidal";

export type TrainingBlocks = {
  vo2max?: boolean;
  ftp?: boolean;
  threshold?: boolean;
};

export interface Preferences {
  days_off: DayAbbrev[];
  long_run_days: DayAbbrev[];
  avoid_back_to_back_hard: boolean;
  two_a_day: TwoADayPrefs;
  intensity_model?: IntensityModel; 
  training_blocks?: TrainingBlocks;
  hr_zone_calc_mode?: ZoneCalcMode;
  womens_health?: WomensHealth;
  detailed_mode?: boolean;
}

export type RehabFocus = {
  stretching: boolean;
  mobility: boolean;
  balance: boolean;
  recovery_protocol?: string | null;
};

/* -------- injuries (Ponechané typy pre DetailHealthLog) -------- */

export type InjuryArea =
  | "foot"
  | "ankle"
  | "achilles"
  | "shin"
  | "calf"
  | "knee"
  | "quad"
  | "hamstring"
  | "glute"
  | "hip"
  | "psoas"
  | "groin"
  | "abdomen"
  | "back"
  | "neck"
  | "shoulder"
  | "arm_wrist"
  | "other";

export type InjuryType =
  | "overuse"
  | "acute"
  | "muscle_strain"
  | "tendon"
  | "stress"
  | "shin_splints"
  | "plantar"
  | "itb"
  | "other";

export type Injury = {
  area: InjuryArea;
  type: InjuryType;
  note?: string;
  severity?: number; // 1-10
};

/* -------- Main prefs -------- */

export type CoachPrefs = {
  weeks?: number;
  start_date?: string | null;
  end_date?: string | null;

  goal_kind?: GoalKind;
  volume?: VolumePrefs;

  main_sport?: SportKind | null;
  add_on_sports?: SportKind[];

  targets?: {
    run?: RunTargets;
    ride?: BikeTargets;
    swim?: SwimTargets;
  };

  preferences?: Preferences;
  strength_settings?: StrengthSettings | null;

  zones?: Zones;
  thresholds?: Thresholds;
};

export const DEFAULT_PREFS: CoachPrefs = {
  goal_kind: "improve_overall",
  main_sport: "run",
  add_on_sports: [],
  volume: { mode: "weekly_hours", value: null },

  targets: {
    run: {
      races: [],
      race_goal: null,
      custom_distance_km: null,
      current_best_time: null,
      target_time: null,
      longest_recent_distance_km: null,
      priority: null,
      race_type: null,
      terrain: null,
      elevation_profile: null,
    },
    ride: { focus: "endurance", weekly_time_target_min: null },
    swim: { focus: "endurance", weekly_time_target_min: null, sessions_per_week: null },
  },

  preferences: {
    days_off: [],
    long_run_days: ["Sat"],
    avoid_back_to_back_hard: false,
    two_a_day: { enabled: true, max_days_per_week: 2 },
    intensity_model: "polarized",
    training_blocks: {},
    hr_zone_calc_mode: "manual",
    womens_health: { sync_enabled: false, cycle_length_days: 28, next_cycle_start: null },
    detailed_mode: true,
  },

  strength_settings: {
    location: "gym",
    equipment_mode: "full_gym",
    available: [],
    sessions_per_week: 2,
  },
};