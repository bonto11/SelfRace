// src/features/coach/types/coachApiTypes.ts
import type { CoachPrefs } from "@/features/coach/types/prefsTypes";

export type ZonesPayload = {
  hr_max?: number | null;
  z1_min?: number | null; z1_max?: number | null;
  z2_min?: number | null; z2_max?: number | null;
  z3_min?: number | null; z3_max?: number | null;
  z4_min?: number | null; z4_max?: number | null;
  z5_min?: number | null; z5_max?: number | null;
};

export type ThresholdsPayload = {
  sport?: string | null;
  hr_bpm?: number | null;        // LTHR – normalized
  pace_sec_km?: number | null;
  power_watt?: number | null;
  threshold_type?: string | null;
  measurement_type?: string | null;
  updated_at?: string | null;
};

export type AnalyzePayloadBE = {
  schema_version: number;

  // plan/meta
  weeks?: number;
  goal_kind?: CoachPrefs["goal_kind"];
  plan_start_date?: string | null;

  // sports & prefs
  primary_sports?: string[];
  main_sport?: CoachPrefs["main_sport"];
  secondary_mix?: NonNullable<CoachPrefs["secondary_mix"]>;
  targets?: CoachPrefs["targets"];
  rules?: CoachPrefs["preferences"];
  externals?: CoachPrefs["external_activities"];
  injuries?: CoachPrefs["injuries"];
  focus?: {
    areas?: string[];
    avoid_zones?: string[];
    rehab?: CoachPrefs["rehab_focus"];
  };
  intensity_model?: "polarized" | "pyramidal" | null;
  blocks?: { vo2max?: boolean; threshold?: boolean; ftp?: boolean };
  strength_settings?: CoachPrefs["strength_settings"];

  // voice
  coach_voice?: CoachPrefs["coach_voice"];
  coach_tone?: CoachPrefs["coach_tone"];

  // zóny + prahy
  zones?: CoachPrefs["zones"];
  thresholds?: CoachPrefs["thresholds"];

  // legacy (voliteľné)
  legacy?: {
    distance?: CoachPrefs["distance"];
    current_pace?: CoachPrefs["current_pace"];
    target_pace?: CoachPrefs["target_pace"];
  };

  // dopĺňame vo FE
  bests?: any;
};

/** Extra flagy k API volaniu. */
export type AnalyzeOptions = {
  debugRaw?: boolean;      // -> payload.debug
  explicitModel?: string;  // -> payload.model
};

/** Očakávaná odpoveď z BE /coach/athlete/analyze/:user_id */
export type AnalyzeAthleteStateResponse = {
  success: boolean;
  state_id: number | null;
  state: any;   // CoachAthleteState
  input: any;   // CoachAnalyzeInput
  model: string;
};

/** Generický fail z BE (detail je optional). */
export type ApiFail = { success: false; detail?: string };