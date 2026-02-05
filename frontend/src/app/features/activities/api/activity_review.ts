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

type EnqueueJobResponse = {
  success: boolean;
  job: AsyncJobRow | null;
  note?: string | null;
  detail?: string | null;
  error?: string | null;
};

type RunJobResponse = {
  success: boolean;
  job: AsyncJobRow | null;
  detail?: string | null;
  error?: string | null;
};

export type ActivityReviewEnqueueOpts = {
  runNow?: boolean;
  debug?: boolean;
  model?: string | null;
  // ⚠️ FE sem service nedávaj (produkcia). Worker/cron si to rieši sám.
};

export async function apiEnqueueActivityReview(
  userId: number,
  activityId: number,
  opts: ActivityReviewEnqueueOpts = {},
): Promise<{ success: true; job: AsyncJobRow; result: any }> {
  if (!userId) throw new Error("userId is required");
  if (!activityId) throw new Error("activityId is required");

  const runNow = opts.runNow ?? true;

  const enqueuePath = `/jobs/enqueue/${encodeURIComponent(String(userId))}`;

  const enqueueBody = {
    job_type: "activity_review",
    payload: {
      activity_id: activityId,
      debug: Boolean(opts.debug ?? false),
      model: opts.model ?? null,
      // service: false implicit – BE nech si zoberie auth z cookies/JWT
    },
    priority: 150,
    max_attempts: 1,
    dedupe_key: `activity_review:${userId}:${activityId}`,
  };

  const enqueueJson = await callBackend<EnqueueJobResponse>(enqueuePath, {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(enqueueBody),
  });

  if (!enqueueJson?.success || !enqueueJson.job) {
    throw new Error(
      enqueueJson.detail ||
        enqueueJson.error ||
        enqueueJson.note ||
        "Failed to enqueue activity_review job",
    );
  }

  const job = enqueueJson.job;

  if (!runNow) return { success: true, job, result: job.result };

  const runPath = `/jobs/run/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(job.id))}`;

  const runJson = await callBackend<RunJobResponse>(runPath, {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
  });

  if (!runJson?.success || !runJson.job) {
    throw new Error(
      runJson.detail || runJson.error || "activity_review job failed",
    );
  }

  const result = runJson.job.result;
  maybeThrowAiQuotaError(result);

  return { success: true, job: runJson.job, result };
}

// ✅ NEW: GET review pre activity
export async function apiGetActivityReview(
  userId: number,
  activityId: number,
): Promise<{ review: any | null; created_at?: string | null }> {
  if (!userId) throw new Error("userId is required");
  if (!activityId) throw new Error("activityId is required");

  const path = `/activities/review/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(activityId))}`;

  // očakávame napr { success:true, review:..., created_at:... } alebo {success:true, review:null}
  const json = await callBackend<any>(path, {
    method: "GET",
    cache: "no-store",
  });

  console.log("apiGetActivityReview", json);

  if (!json?.success) {
    throw new Error(
      json?.detail || json?.error || "Failed to load activity review",
    );
  }

  return {
    review: json.review ?? null,
    created_at: json.created_at ?? null,
  };
}
