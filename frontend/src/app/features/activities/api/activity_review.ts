// src/app/features/activities/api/activity_review.ts
import { callBackend } from "@/app/shared/utils/callBackend";
import { maybeThrowAiQuotaError } from "@/app/features/coach/api/coach_athlete_state";

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

// src/app/features/activities/api/activity_review.ts

export type ActivityReviewEnqueueOpts = {
  runNow?: boolean;
  model?: string | null;
  comment?: string | null; // ✅ NEW (premium user input)
};

// src/app/features/activities/api/activity_review.ts

export type ActivityReviewRerunResponse =
  | {
      success: true;
      ok: true;
      job: AsyncJobRow;
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

export async function apiRerunActivityReview(
  userId: number,
  activityId: number,
  opts: { comment?: string | null; model?: string | null } = {},
): Promise<ActivityReviewRerunResponse> {
  if (!userId) throw new Error("userId is required");
  if (!activityId) throw new Error("activityId is required");

  const comment = typeof opts.comment === "string" ? opts.comment.trim() : null;

  const path = `/activities/review/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(activityId))}/rerun`;

  const json = await callBackend<any>(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      comment: comment && comment.length ? comment : null,
      model: opts.model ?? null,
    }),
  });

  // BE vracia vždy {success:boolean, ...}
  if (!json || typeof json.success !== "boolean") {
    throw new Error("Invalid response from activity review rerun endpoint");
  }

  return json as ActivityReviewRerunResponse;
}

export async function apiGetActivityReview(
  userId: number,
  activityId: number,
): Promise<{
  review: any | null;
  updated_at?: string | null;
  ai_review_version?: number | null;
  ai_review_last_user_comment?: string | null;
  ai_review_last_user_comment_at?: string | null;
  ai_review_last_source?: string | null;
}> {
  if (!userId) throw new Error("userId is required");
  if (!activityId) throw new Error("activityId is required");

  const path = `/activities/review/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(activityId))}`;

  // očakávame napr { success:true, review:..., created_at:... } alebo {success:true, review:null}
  const json = await callBackend<any>(path, {
    method: "GET",
    cache: "no-store",
  });

  if (!json?.success) {
    throw new Error(
      json?.detail || json?.error || "Failed to load activity review",
    );
  }

  return {
    review: json.review ?? null,
    updated_at: json.updated_at ?? null,
    ai_review_version: json.ai_review_version ?? null,
    ai_review_last_user_comment: json.ai_review_last_user_comment ?? null,
    ai_review_last_user_comment_at: json.ai_review_last_user_comment_at ?? null,
    ai_review_last_source: json.ai_review_last_source ?? null,
  };
}
