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

export type ActivityReviewEnqueueOpts = {
  runNow?: boolean;
  model?: string | null;
  comment?: string | null; // ✅ NEW (premium user input)
};

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

/**
 * Trigger rerun AND wait for result (sync execution pattern).
 * 1. Enqueue job via service_request_activity_review_rerun
 * 2. Force execute via /jobs/run/:user_id/:job_id
 */
export async function apiRerunActivityReview(
  userId: number,
  activityId: number,
  opts: { comment?: string | null; model?: string | null }
): Promise<any> {
  if (!userId) throw new Error("Missing userId");

  // 1. REQUEST RERUN (Enqueue)
  const requestPath = `/activities/review/run/${userId}/${activityId}`;

  let enqueueJson: any;
  try {
    enqueueJson = await callBackend(requestPath, {
      method: "POST",
      cache: "no-store",
      // ✅ Fix pre chybu 422: Explicitne nastavíme hlavičku a stringifikujeme body
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    });
  } catch (e: any) {
    console.error("[AR] Enqueue Error", e);
    throw new Error(e?.message || "Nepodarilo sa vytvoriť požiadavku.");
  }

  // Ak BE vráti chybu (napr. limit_reached, duplicate_content), vrátime ju do UI
  if (!enqueueJson?.ok) {
    return enqueueJson;
  }

  const jobId = enqueueJson.job_id;
  if (!jobId) {
    // Fallback: ak nemáme job_id, vrátime success (divný stav, ale success)
    return { ok: true, message: "Požiadavka prijatá (bez job id)." };
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
      return { ok: true, message: "Spracovávanie na pozadí..." };
    }

    // Ak success, znamená to, že AI review je hotové a uložené v DB.
    return { ok: true, message: "Hotovo!" };

  } catch (e) {
    console.error("[AR] Sync Run Network Error", e);
    return { ok: true, message: "Požiadavka odoslaná na spracovanie." };
  }
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