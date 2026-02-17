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
  ai_review: any | null;
  updated_at: string | null;
  ai_review_version: number | null;
  ai_review_last_user_comment: string | null;
  ai_review_last_user_comment_at: string | null;
  ai_review_last_source: string | null;
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
      ai_review_version?: number;
      max_versions?: number;
    }
  | {
      success: false;
      ok: false;
      code: string;
      message: string;
      tier?: string;
      ai_review_version?: number;
      max_versions?: number;
    };

