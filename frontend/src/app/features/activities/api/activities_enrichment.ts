// src/app/features/activities/api/activity_review.ts
import { callBackend } from "@/app/shared/utils/callBackend";

export type ActivityEnrichment = {
  activity_id: number;
  // Fyzické metriky
  z1_min: number | null;
  z2_min: number | null;
  z3_min: number | null;
  z4_min: number | null;
  z5_min: number | null;
  sport_type_fe: string | null;
  avg_hr_bpm: number | null;
  moving_time_s: number | null;
  distance_m: number | null;
  // AI Review časť
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
};

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

/**
 * Trigger rerun AND wait for result (sync execution pattern).
 * 1. Enqueue job via service_request_activity_review_rerun
 * 2. Force execute via /jobs/run/:user_id/:job_id
 */
export async function apiRerunActivityReview(
  userId: number,
  activityId: number,
  opts: { comment?: string | null; model?: string | null }
): Promise<ActivityReviewRerunResponse | any> {
  if (!userId) throw new Error("Missing userId");

  // 1. REQUEST RERUN (Enqueue)
  const requestPath = `/activities/enrichment/reviewRun/${userId}/${activityId}`;

  let enqueueJson: any;
  try {
    enqueueJson = await callBackend(requestPath, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    });
  } catch (e: any) {
    console.error("[AR] Enqueue Error", e);
    throw new Error("ERROR_ENQUEUE");
  }

  // Ak BE vráti chybu (napr. limit_reached, duplicate_content), vrátime ju do UI
  if (!enqueueJson?.ok) {
    return enqueueJson;
  }

  const jobId = enqueueJson.job_id;
  if (!jobId) {
    // Fallback: ak nemáme job_id, vrátime QUEUED
    return { success: true, ok: true, status: "QUEUED" };
  }

  // 2. FORCE RUN (Sync Execution)
  // Toto zavolá service_run_job_now na backende
  const runPath = `/jobs/run/${userId}/${jobId}`;

  try {
    const runJson = await callBackend<any>(runPath, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });

    if (!runJson?.success) {
      console.warn("[AR] Sync Run Failed/Timeout", runJson);
      // Job ostane v DB a worker ho spracuje. UI dostane info, že sa pracuje.
      return { success: true, ok: true, status: "PROCESSING" };
    }

    // Ak success, znamená to, že AI review je hotové a uložené v DB.
    return { success: true, ok: true, status: "SUCCESS" };

  } catch (e) {
    console.error("[AR] Sync Run Network Error", e);
    // V prípade sieťovej chyby pri pokuse o sync run vrátime QUEUED (job je v DB)
    return { success: true, ok: true, status: "QUEUED" };
  }
}

export async function apiGetActivityEnrichment(
  userId: number,
  activityId: number,
): Promise<ActivityEnrichment | null> {
  if (!userId) throw new Error("userId is required");
  if (!activityId) throw new Error("activityId is required");

  const path = `/activities/enrichment/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(activityId))}`;

  const json = await callBackend<any>(path, {
    method: "GET",
    cache: "no-store",
  });

  if (!json?.success) {
    // Akceptujeme aj null (ak ešte nie je enrichment vytvorený)
    return null; 
  }

  return json.data;
}