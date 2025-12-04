// src/features/coach/types/prefsTypes.ts
import type { DayAbbrev } from "@/shared/types/day";

/** Hlavné ciele plánu / tréningu (už bez "race_time"). */
export type GoalKind =
  | "improve_speed"
  | "improve_endurance"
  | "improve_overall"
  | "maintain";

/** Podporované športy v coach prefs. */
export type SportKind = "run" | "ride" | "strength" | "swim";

/** Coach personality (EN) + custom; allow null for "none selected". */
export type CoachPersona =
  | "drill_sergeant"
  | "motivator"
  | "analyst"
  | "realist"
  | "custom";

export type RacePriority = "A" | "B" | "C";

/* -------- Race meta pre behy -------- */

/** Štandardizované vzdialenosti + možnosť vlastnej. */
export type RaceDistanceKind =
  | "5k"
  | "10k"
  | "half"
  | "marathon"
  | "ultra"
  | "other";

/** Typ behu / preteku. */
export type RaceType = "road" | "trail" | "track" | "cross" | "ocr" | "other";

/** Charakter terénu. */
export type RaceTerrain = "flat" | "rolling" | "hilly" | "mountain";

/** Hrubé kategórie prevýšenia. */
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
  hr_bpm?: number | null; // normalizované (HR_bpm -> hr_bpm)
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

/* -------- Targets -------- */

export interface RunRaceTarget {
  /** lokálne ID pre FE (uuid/string) – voliteľné, BE to nemusí riešiť */
  id?: string;

  /** názov preteku (Bratislava marathon, lokálny trail…) */
  name?: string | null;

  /** dátum preteku (ISO YYYY-MM-DD) */
  date?: string | null;

  /** dôležitosť preteku (A = hlavný cieľ, B/C doplnkové) */
  priority?: RacePriority | null;

  /** typ cieľovej vzdialenosti (5k/10k/half/marathon/ultra/other) */
  race_goal?: RaceDistanceKind | null;

  /**
   * Vlastná dĺžka preteku v km (napr. 7.5, 25, 50).
   * Typicky keď race_goal === "other" alebo "ultra".
   */
  custom_distance_km?: number | null;

  /** cieľový čas – "hh:mm:ss" */
  target_time?: string | null;

  /** typ preteku (cesta, trail, dráha, OCR, …) */
  race_type?: RaceType | null;

  /** charakter terénu (rovina/kopcovitý/hory…) */
  terrain?: RaceTerrain | null;

  /** hrubé prevýšenie – low/moderate/high */
  elevation_profile?: RaceElevationProfile | null;

  /** voliteľne konkrétne stúpanie v metroch (celkové prevýšenie) */
  elevation_gain_m?: number | null;
}

/**
 * RunTargets = globálne info pre beh + (do budúcna) zoznam key races.
 * Teraz používame hlavne top-level polia, ale necháme aj `races` kvôli starým dátam.
 */
export interface RunTargets {
  /** zoznam pretekov (legacy + future) */
  races?: RunRaceTarget[];

  /** typ cieľovej vzdialenosti (5k/10k/half/marathon/ultra/other) */
  race_goal: RaceDistanceKind | null;

  /** vlastná dĺžka preteku v km */
  custom_distance_km?: number | null;

  /** aktuálny osobák na túto vzdialenosť – "hh:mm:ss" */
  current_best_time: string | null;

  /** cieľový čas – "hh:mm:ss" */
  target_time: string | null;

  /** najdlhší nedávny beh (napr. posledných 6–8 týždňov) */
  longest_recent_distance_km: number | null;

  /** dôležitosť preteku (A = hlavný cieľ, B/C doplnkové) */
  priority?: RacePriority | null;

  /** typ preteku (cesta, trail, dráha, OCR, …) */
  race_type?: RaceType | null;

  /** charakter terénu (rovina/kopcovitý/hory…) */
  terrain?: RaceTerrain | null;

  /** hrubé prevýšenie – low/moderate/high */
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

/* -------- External / injuries -------- */

export type ExternalSport =
  | "football"
  | "run"
  | "ride"
  | "strength"
  | "swim"
  | "other";

export type ExternalIntensity = "low" | "moderate" | "high";

export type ExternalActivity = {
  day: DayAbbrev;
  sport: ExternalSport;
  intensity: ExternalIntensity;
  note?: string;
};

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

/** voľný slovník, nech vieme poslať AI aj konkrétne kusy náradia */
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

 export interface Preferences{
    days_off: DayAbbrev[];
    long_run_days: DayAbbrev[];
    avoid_back_to_back_hard: boolean;
    use_zones: boolean;
    avoid_two_a_day: boolean;
    include_strides?: boolean;
  }

/* -------- Main prefs -------- */

export type CoachPrefs = {
  /** overall goal (speed/endurance/overall/maintain) */
  goal_kind?: GoalKind;

  // legacy pace fields – môžu časom zmiznúť
  distance?: string;
  current_pace?: string;
  target_pace?: string;

  /** default horizon v týždňoch (voliteľné) */
  weeks?: number;

  sports?: SportKind[]; // legacy
  primary_sports?: SportKind[];

  // všetky 3 sú voliteľné – vieme ukladať iba run, bez prázdneho ride/strength
  targets?: {
    run?: RunTargets;
    ride?: BikeTargets;
    strength?: StrengthTargets;
  };

  preferences?: Preferences;

  // legacy aliases
  avoid_back_to_back_hard?: boolean;
  avoid_two_a_day?: boolean;
  preferred_long_run_days?: DayAbbrev[];

  goal_text_override?: string;

  /* ---- Extensions ---- */
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

  external_activities?: ExternalActivity[];
  injuries?: Injury[];
  focus_areas?: string[];
  avoid_zones?: string[];

  rehab_focus?: RehabFocus;

  coach_voice?: CoachPersona | null; // null → none selected
  coach_tone?: {
    directness: number;
    praise: number;
    challenge: number;
    emoji: number;
    explain: number;
  };

  /** plán-štart (ISO YYYY-MM-DD); UI default = dnes + 2, min = zajtra */
  start_date?: string | null;

  /** preferencie pre silu */
  strength_settings?: StrengthSettings | null;

  /** NEW: top-level fyzio info */
  zones?: Zones;
  thresholds?: Thresholds;
};

export const DEFAULT_PREFS: CoachPrefs = {
  goal_kind: "improve_overall",
  primary_sports: ["run"],
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
  },
  preferences: {
    days_off: ["Mon", "Fri"],
    long_run_days: ["Sat", "Sun"],
    avoid_back_to_back_hard: true,
    use_zones: true,
    avoid_two_a_day: true,
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