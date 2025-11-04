// src/features/coach/types/prefsTypes.ts
import type { DayAbbrev } from "@/shared/types/day";

export type GoalKind =
  | "race_time"
  | "improve_speed"
  | "improve_endurance"
  | "improve_overall"
  | "maintain";

export type SportKind = "run" | "ride" | "strength" | "mixed" | "skate";

export interface Preferences {
  days_off: DayAbbrev[];
  long_run_days?: DayAbbrev[];
  avoid_back_to_back_hard: boolean;
  use_zones: boolean;
  wu_cd_detail: boolean;
  include_strides?: boolean;
}

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

export type CoachPrefs = {
  goal_kind?: GoalKind;
  distance?: string;
  current_pace?: string;
  target_pace?: string;

  weeks?: number;
  sports?: SportKind[];           // legacy
  primary_sports?: SportKind[];

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
};