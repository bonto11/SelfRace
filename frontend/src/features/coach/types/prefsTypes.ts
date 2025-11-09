// src/features/coach/types/prefsTypes.ts
import type { DayAbbrev } from "@/shared/types/day";

export type GoalKind =
  | "race_time"
  | "improve_speed"
  | "improve_endurance"
  | "improve_overall"
  | "maintain";

export type SportKind = "run" | "ride" | "strength" | "mixed" | "skate";

/** Coach personality (komunikačný štýl AI trénera) */
export type CoachPersona = "kapral" | "hecovac" | "statistik" | "realista";

/* -------- Preferences (jadro) -------- */
export interface Preferences {
  days_off: DayAbbrev[];
  long_run_days?: DayAbbrev[];
  avoid_back_to_back_hard: boolean;
  use_zones: boolean;
  wu_cd_detail: boolean;
  include_strides?: boolean;
}

/* -------- Targets -------- */
export interface RunTargets {
  race_goal: "5k" | "10k" | "half" | "marathon" | null;
  current_best_time: string | null;
  target_time: string | null;
  longest_recent_distance_km: number | null;
}

export interface BikeTargets {
  focus: "endurance" | "ftp" | "vo2";
  weekly_time_target_min: number | null;
}

export interface StrengthTargets {
  focus: "general" | "hypertrophy" | "max_strength";
  sessions_per_week: number;
}

/* -------- Externé aktivity / zranenia -------- */
export type ExternalSport = "football" | "run" | "ride" | "strength" | "other";
export type ExternalIntensity = "low" | "moderate" | "high";
export type ExternalActivity = {
  day: DayAbbrev;
  sport: ExternalSport;
  intensity: ExternalIntensity;
  note?: string;
};

export type InjuryArea =
  | "foot" | "ankle" | "shin" | "knee" | "hip" | "hamstring" | "calf" | "back" | "shoulder" | "other";
export type InjuryType =
  | "overuse" | "acute" | "tendon" | "stress" | "shin_splints" | "plantar" | "itb" | "other";
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

/* -------- Hlavný typ CoachPrefs -------- */
export type CoachPrefs = {
  goal_kind?: GoalKind;
  distance?: string;
  current_pace?: string;
  target_pace?: string;

  weeks?: number;
  sports?: SportKind[];           // legacy
  primary_sports?: SportKind[];

  // rozšírené ciele
  targets?: {
    run: RunTargets;
    ride: BikeTargets;
    strength: StrengthTargets;
  };

  preferences?: Preferences;

  // legacy aliasy
  prefer_two_hard_days_apart?: boolean;
  include_wu_cd_details?: boolean;
  preferred_long_run_days?: DayAbbrev[];

  goal_text_override?: string;

  /* ---- Rozšírenia (voliteľné) ---- */
  main_sport?: SportKind | null;
  secondary_mix?: { sport: SportKind; role: "supplement" | "improve"; share_pct: number }[];

  // tréningové modely/bloky
  vo2max_training?: boolean;
  ftp_training?: boolean;
  threshold_focus?: boolean;
  polarized_model?: boolean;
  pyramidal_model?: boolean;

  // externé aktivity, zranenia, fokus/avoid
  external_activities?: ExternalActivity[];
  injuries?: Injury[];
  focus_areas?: string[];
  avoid_zones?: string[];

  // rehab
  rehab_focus?: RehabFocus;

  // osobnosť trénera a jemné nastavenia tónu
  coach_voice?: CoachPersona;
  coach_tone?: { directness: number; praise: number; challenge: number; emoji: number; explain: number };
};

export const DEFAULT_PREFS: CoachPrefs = {
  goal_kind: "improve_overall",
  primary_sports: ["run", "ride", "strength"],
  targets: {
    run: { race_goal: null, current_best_time: null, target_time: null, longest_recent_distance_km: null },
    ride: { focus: "endurance", weekly_time_target_min: null },
    strength: { focus: "general", sessions_per_week: 2 },
  },
  preferences: {
    days_off: ["Mon", "Fri"],
    long_run_days: ["Sat", "Sun"],
    avoid_back_to_back_hard: true,
    use_zones: true,
    wu_cd_detail: true,
  },
  coach_voice: "hecovac",
  coach_tone: { directness: 50, praise: 60, challenge: 55, emoji: 20, explain: 60 },
};