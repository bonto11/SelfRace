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
  runNow?: boolean; // default true
  debug?: boolean; // default false
  model?: string | null;
  service?: boolean; // default false (FE mode)
};

export async function apiEnqueueActivityReview(
  userId: number,
  userUid: string,      // ✅ povinné pre BE schema (body.user_uid)
  activityId: number,
  opts: ActivityReviewEnqueueOpts = {}
): Promise<{ success: true; job: AsyncJobRow; result: any }> {
  if (!userId) throw new Error("userId is required");
  if (!userUid) throw new Error("userUid is required");
  if (!activityId) throw new Error("activityId is required");

  const runNow = opts.runNow ?? true;

  // 1) ENQUEUE
  const enqueuePath = `/jobs/enqueue/${encodeURIComponent(String(userId))}`;

  const enqueueBody = {
    job_type: "activity_review",
    user_uid: userUid, // ✅ FIX: BE chce user_uid (nie user_uuid)
    payload: {
      activity_id: activityId,
      debug: Boolean(opts.debug ?? false),
      model: opts.model ?? null,
      service: Boolean(opts.service ?? false), // FE → false (worker použije user_jwt)
    },
    priority: 150,
    max_attempts: 1,
    dedupe_key: `activity_review:${userId}:${activityId}`,
  };

  let enqueueJson: EnqueueJobResponse;
  try {
    enqueueJson = await callBackend<EnqueueJobResponse>(enqueuePath, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(enqueueBody),
    });
  } catch (err: any) {
    console.error("[ActivityReview][enqueue] ERROR", err);
    throw err instanceof Error ? err : new Error(String(err));
  }

  if (!enqueueJson?.success || !enqueueJson.job) {
    const msg =
      enqueueJson.detail ||
      enqueueJson.error ||
      enqueueJson.note ||
      "Failed to enqueue activity_review job";
    throw new Error(msg);
  }

  const job = enqueueJson.job;

  // 2) RUN (optional) – rovnako ako weekly
  if (!runNow) {
    return { success: true, job, result: job.result };
  }

  const runPath = `/jobs/run/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(job.id))}`;

  let runJson: RunJobResponse;
  try {
    runJson = await callBackend<RunJobResponse>(runPath, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
    });
  } catch (err: any) {
    console.error("[ActivityReview][run] ERROR", err);
    throw err instanceof Error ? err : new Error(String(err));
  }

  if (!runJson?.success || !runJson.job) {
    const msg = runJson.detail || runJson.error || "activity_review job failed";
    throw new Error(msg);
  }

  const result = runJson.job.result;

  // ak BE vracia quota error v result-e, vyhodí to exception
  maybeThrowAiQuotaError(result);

  return { success: true, job: runJson.job, result };
}