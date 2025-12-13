// src/features/coach/types/coachApiTypes.ts

// Z tvojho pôvodného súboru som nechal len to, čo ešte súvisí s analyze

export type AnalyzeOptions = {
  debugRaw?: boolean;      // -> body.debug
  explicitModel?: string;  // -> body.model
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

export type AnalyzeResult = {
  analysis: any | null; // CoachAthleteState
  model: string | null;
  state_id: number | null;
};