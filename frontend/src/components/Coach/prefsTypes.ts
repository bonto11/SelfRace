// ========================
// Typy pre AI Coach prefs
// ========================

export type GoalKind =
  | "race_time"
  | "improve_speed"
  | "improve_endurance"
  | "improve_overall"
  | "maintain";

export type SportKind = "run" | "bike" | "strength";

export type DayAbbrev =
  | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

// --- Targets (ciele pre jednotlivé športy) ---

export interface RunTargets {
  race_goal: "5k" | "10k" | "half" | "marathon" | null;
  current_best_time: string | null;        // "00:45:30"
  target_time: string | null;              // "00:44:00"
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

// --- Preferencie plánovania ---

export interface Preferences {
  days_off: DayAbbrev[];         // napr. ["Mon","Fri"]
  long_run_days?: DayAbbrev[];   // napr. ["Sat","Sun"]
  avoid_back_to_back_hard: boolean;
  use_zones: boolean;
  wu_cd_detail: boolean;
}

// --- Hlavný tvar preferencií od používateľa ---

export type CoachPrefs = {
  // cieľ (voľné pole aj štruktúra)
  goal_kind?: GoalKind;
  distance?: string;         // "5k" | "10k" | ...
  current_pace?: string;     // "5:10"
  target_pace?: string;      // "4:30"

  // plánovanie
  weeks?: number;            // 8, 10, 12...
  sports?: SportKind[];      // legacy: ["run","bike","strength"]
  primary_sports?: SportKind[]; // preferované pole pre backend

  // štruktúrované ciele
  targets?: {
    run: RunTargets;
    bike: BikeTargets;
    strength: StrengthTargets;
  };

  // preferencie
  preferences?: Preferences;

  // legacy/alias polia (ponechané kvôli spätnému súladu)
  prefer_two_hard_days_apart?: boolean;        // alias k preferences.avoid_back_to_back_hard
  include_wu_cd_details?: boolean;             // alias k preferences.wu_cd_detail
  preferred_long_run_days?: DayAbbrev[];       // alias k preferences.long_run_days

  // voľný override textu cieľa
  goal_text_override?: string;
};

// --- Default hodnota, sedí s CoachPrefs ---

export const DEFAULT_PREFS: CoachPrefs = {
  goal_kind: "improve_overall",
  primary_sports: ["run", "bike", "strength"],
  targets: {
    run: {
      race_goal: null,
      current_best_time: null,
      target_time: null,
      longest_recent_distance_km: null,
    },
    bike: { focus: "endurance", weekly_time_target_min: null },
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