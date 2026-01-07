// src/features/prefs/types/prefs.ts
import type { DayAbbrev } from "@/app/shared/types/day";

/** Hlavné ciele plánu / tréningu (už bez "race_time"). */
export type GoalKind =
  | "improve_speed"
  | "improve_endurance"
  | "improve_overall"
  | "maintain";

/** Podporované športy v coach prefs. */
export type SportKind = "run" | "ride" | "strength" | "swim";

export type SecondaryRole = "none" | "supplement" | "improve";

export type SecondaryMix = {
  sport: SportKind;
  role: SecondaryRole;
  share_pct: number;
};

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

/* -------- Race meta pre behy -------- */

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

/* -------- Zones & Thresholds (NEW) -------- */

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

/** NEW: Swim targets – nech vieme časom generovať swim tréningy */
export interface SwimTargets {
  /** Hlavný swim fokus */
  focus: "technique" | "endurance" | "speed" | "open_water";
  /** Cieľový týždenný čas v minútach (alebo null, ak nerieši) */
  weekly_time_target_min: number | null;
  /** Voliteľne počet swim sessions za týždeň */
  sessions_per_week?: number | null;
}

/* -------- injuries -------- */

export type InjuryArea =
  | "foot"
  | "ankle"
  | "shin"
  | "knee"
  | "hip"
  | "hamstring"
  | "calf"
  | "back"
  | "shoulder"
  | "other";

export type InjuryType =
  | "overuse"
  | "acute"
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
};

export type RehabFocus = {
  stretching: boolean;
  mobility: boolean;
  balance: boolean;
  recovery_protocol?: string | null;
};

export type StrengthLocation = "gym" | "home" | "outdoor";
export type StrengthEquipmentMode =
  | "none"
  | "bodyweight"
  | "minimal"
  | "full_gym";

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
};

export interface Preferences {
  days_off: DayAbbrev[];
  long_run_days: DayAbbrev[];
  avoid_back_to_back_hard: boolean;
  use_zones: boolean;
  avoid_two_a_day: boolean;
  include_strides?: boolean;
}

// --- Advanced weekly template --------------------------------

export type WeeklyTemplateMode = "off" | "loose" | "strict";

export type TemplateSportKind = SportKind | "other";

export type RunTemplateKind =
  | "easy"
  | "long"
  | "tempo"
  | "threshold"
  | "intervals"
  | "vo2max"
  | "hills"
  | "recovery";

export type StrengthTemplateKind =
  | "upper"
  | "lower"
  | "full"
  | "core"
  | "hiit";

export type SessionPriority = "key" | "support" | "optional";

export type SessionTemplate = {
  sport: TemplateSportKind;
  kind: RunTemplateKind | StrengthTemplateKind | "other";
  priority: SessionPriority;
  /** či smie coach posunúť tréning na iný deň (hlavne v `loose` mode) */
  ai_can_move?: boolean;
};

export type DayTemplate = {
  day: DayAbbrev;
  slots: SessionTemplate[]; // max 0–2
};

export type WeeklyTemplate = {
  mode: WeeklyTemplateMode;
  days: DayTemplate[];
};

/* -------- Main prefs -------- */

export type CoachPrefs = {
  goal_kind?: GoalKind;
  distance?: string;
  current_pace?: string;
  target_pace?: string;
  weeks?: number;
  sports?: SportKind[];
  volume?: VolumePrefs;
  primary_sports?: SportKind[];
  targets?: {
    run?: RunTargets;
    ride?: BikeTargets;
    strength?: StrengthTargets;
    swim?: SwimTargets;
  };
  preferences?: Preferences;

  avoid_back_to_back_hard?: boolean;
  avoid_two_a_day?: boolean;
  preferred_long_run_days?: DayAbbrev[];

  goal_text_override?: string;

  main_sport?: SportKind | null;
  secondary_mix?: {
    sport: SportKind;
    role: "none" | "supplement" | "improve";
    share_pct: number;
  }[];

  vo2max_training?: boolean;
  ftp_training?: boolean;
  threshold_focus?: boolean;
  polarized_model?: boolean;
  pyramidal_model?: boolean;

  injuries?: Injury[];
  focus_areas?: string[];
  avoid_zones?: string[];

  rehab_focus?: RehabFocus;

  coach_voice?: CoachPersona | null;
  coach_tone?: {
    directness: number;
    praise: number;
    challenge: number;
    emoji: number;
    explain: number;
  };

  start_date?: string | null;
  strength_settings?: StrengthSettings | null;
  zones?: Zones;
  thresholds?: Thresholds;

  /** NEW: celý weekly template je top-level pole v prefs */
  weekly_template?: WeeklyTemplate | null;
};

export const DEFAULT_PREFS: CoachPrefs = {
  goal_kind: "improve_overall",
  primary_sports: ["run"],
  volume: {
    mode: "weekly_hours",
    value: null,
  },
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
    strength: { focus: "general", sessions_per_week: 2 },
    swim: {
      focus: "endurance",
      weekly_time_target_min: null,
      sessions_per_week: null,
    },
  },
  preferences: {
    days_off: ["Mon", "Fri"],
    long_run_days: ["Sat", "Sun"],
    avoid_back_to_back_hard: true,
    use_zones: true,
    avoid_two_a_day: true,
  },
  weekly_template: {
    mode: "off",
    days: [],
  },
  coach_voice: "motivator",
  coach_tone: {
    directness: 55,
    praise: 80,
    challenge: 60,
    emoji: 35,
    explain: 55,
  },
};