// src/app/features/activities/types/activities_enrichment.ts

type AsyncJobRow = {
  id: number;
  user_id: number;
  job_type: string;
  status: string;
  progress: number;
  error: string | null;
  result: any | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export type ReviewPayload = {
  schema_version?: number;
  generated_at?: string;
  model?: string;
  activity_id?: number | null;
  sport?: string;
  session_kind?: string;
  review_text?: string;
  next_day_plan?: string;
  key_numbers?: {
    duration_min?: number;
    distance_km?: number;
    avg_hr_bpm?: number;
    max_hr_bpm?: number;
    dominant_zone?: string;
    [k: string]: any;
  };
  suggested_thresholds?: {
    sport?: string;
    threshold_type?: string;
    hr_bpm?: number | null;
    pace_sec_km?: number | null;
    power_watt?: number | null;
    notes?: string;
  } | null;
  flags?: { used_user_comment?: boolean; needs_caution?: boolean };
  [k: string]: any;
};

export type ThreadAssistantEntry = {
  role: "assistant";
  created_at?: string;
  source?: string;
  review: ReviewPayload;
};

export type ThreadUserEntry = {
  role: "user";
  created_at?: string;
  comment?: string | null;
  is_race_effort?: boolean;
};

export type ThreadEntry = ThreadAssistantEntry | ThreadUserEntry;

export type ActivityEnrichment = {
  activity_id: number;
  z1_min: number | null;
  z2_min: number | null;
  z3_min: number | null;
  z4_min: number | null;
  z5_min: number | null;
  sport_type_fe: string | null;
  avg_hr_bpm: number | null;
  moving_time_s: number | null;
  distance_m: number | null;
  updated_at: string | null;
  ai_review_thread: ThreadEntry[];
};

export type ActivityReviewEnqueueOpts = {
  runNow?: boolean;
  model?: string | null;
  comment?: string | null;
  has_new_injury?: boolean;
};

export type ActivityReviewRerunResponse =
  | {
      success: true;
      ok: true;
      status: "SUCCESS" | "PROCESSING" | "QUEUED";
      job?: AsyncJobRow;
      note?: string | null;
      tier?: string;
      next_version?: number;
      max_versions?: number;
    }
  | {
      success: false;
      ok: false;
      code: string;
      message: string;
      tier?: string;
      next_version?: number;
      max_versions?: number;
    };
