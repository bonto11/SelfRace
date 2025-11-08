import type { DayAbbrev } from "@/shared/types/day";

export type GoalKind =
  | "race_time"
  | "improve_speed"
  | "improve_endurance"
  | "improve_overall"
  | "maintain";

export type SportKind = "run" | "ride" | "strength" | "mixed" | "skate";

/* --- NOVÉ typy pre pokročilé preferencie --- */
export type ExternalIntensity = "low" | "moderate" | "high";
export type ExternalSport = SportKind | "football" | "other";
export type InjuryArea =
  | "foot" | "ankle" | "shin" | "knee" | "hip"
  | "hamstring" | "calf" | "back" | "shoulder" | "other";
export type InjuryType =
  | "overuse" | "acute" | "tendon" | "stress" | "shin_splints"
  | "plantar" | "itb" | "other";

export interface ExternalActivity {
  day: DayAbbrev;               // napr. "Tue"
  sport: ExternalSport;         // napr. "football"
  intensity: ExternalIntensity; // low/moderate/high
  note?: string | null;
}

export interface Injury {
  area: InjuryArea;             // napr. "foot"
  type: InjuryType;             // napr. "overuse"
  note?: string | null;         // “bolesť nártov po dlhých behoch”
}

export interface RehabFocus {
  stretching: boolean;
  mobility: boolean;
  balance: boolean;
  recovery_protocol?: string | null; // napr. "ankle_mobility_and_foot_strength"
}

export interface Preferences {
  days_off: DayAbbrev[];
  long_run_days?: DayAbbrev[];
  avoid_back_to_back_hard: boolean;
  use_zones: boolean;
  wu_cd_detail: boolean;
  include_strides?: boolean;
}

/* --- existujúce targets --- */
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

  /* --- NOVÉ pokročilé voľby (voliteľné) --- */
  vo2max_training?: boolean;      // beh VO2 bloky
  ftp_training?: boolean;         // bike FTP bloky
  threshold_focus?: boolean;      // viac prahu
  polarized_model?: boolean;      // 80/20
  pyramidal_model?: boolean;      // pyramída Z1>Z2>Z3

  external_activities?: ExternalActivity[]; // napr. futbal v Utorok (high)
  injuries?: Injury[];                       // obmedzenia/zranenia
  focus_areas?: string[];                    // napr. ["ankle_strength","core_stability"]
  avoid_zones?: string[];                    // napr. ["impact_high","downhill_runs"]
  rehab_focus?: RehabFocus;                  // mobility/balance/stretčing

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
  /* defaulty pokročilých – opatrné */
  vo2max_training: false,
  ftp_training: false,
  threshold_focus: false,
  polarized_model: false,
  pyramidal_model: true,
  external_activities: [],
  injuries: [],
  focus_areas: [],
  avoid_zones: [],
  rehab_focus: { stretching: true, mobility: true, balance: true, recovery_protocol: null },
};