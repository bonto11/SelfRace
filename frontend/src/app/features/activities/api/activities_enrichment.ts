// src/app/features/activities/api/activities_enrichment.ts
import { callBackend } from "@/app/shared/utils/callBackend";
import type {
  ActivityEnrichment
} from "@/app/features/activities/types/activities_enrichment";

export async function apiRerunActivityReview(
  userId: number,
  activityId: number,
  opts: { comment?: string | null; model?: string | null; has_new_injury?: boolean; is_race_effort?: boolean }
): Promise<{ success: boolean; status?: string; error_code?: string; message?: string }> {
  if (!userId) throw new Error("api.activities.missingUserId");

  const requestPath = `/activities/enrichment/reviewRun/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(activityId))}`;

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
    return { success: false, error_code: "enqueue_failed", message: "Network error" };
  }

  if (!enqueueJson?.success) {
    return {
      success: false,
      error_code: enqueueJson?.error_code || "REQUEST_FAILED",
      message: enqueueJson?.message || "Nepodarilo sa spustiť AI",
    };
  }

  const jobId = enqueueJson.data?.job_id || enqueueJson.job_id;
  if (!jobId) {
    return { success: true, status: "QUEUED" };
  }

  const runPath = `/jobs/run/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(jobId))}`;

  try {
    const runJson = await callBackend<any>(runPath, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });

    if (!runJson?.success) {
      console.warn("[AR] Sync Run HTTP Failed", runJson);
      return { success: true, status: "PROCESSING" };
    }

    // ✅ NOVÉ: Pozrieme sa dovnútra Jobu, či AI worker nevrátil chybu
    const innerResult = runJson?.data?.result || runJson?.job?.result || runJson?.result;
    if (innerResult && innerResult.ok === false) {
      return {
        success: false,
        error_code: innerResult.code || "ai_generation_failed",
        message: innerResult.message
      };
    }

    // Skontrolujeme, či samotný status Jobu neskončil chybou
    const jobStatus = runJson?.data?.status || runJson?.job?.status || runJson?.status;
    if (jobStatus === "failed" || jobStatus === "error") {
      return {
        success: false,
        error_code: "ai_generation_failed",
        message: "Úloha na pozadí zlyhala."
      };
    }

    return { success: true, status: "SUCCESS" };

  } catch (e) {
    console.error("[AR] Sync Run Network Error", e);
    return { success: true, status: "QUEUED" };
  }
}

export async function apiGetActivityEnrichment(
  userId: number,
  activityId: number,
): Promise<ActivityEnrichment | null> {
  if (!userId) throw new Error("api.activities.missingUserId");
  if (!activityId) throw new Error("api.activities.missingActivityId");

  const path = `/activities/enrichment/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(activityId))}`;

  try {
    const json = await callBackend<any>(path, {
      method: "GET",
      cache: "no-store",
    });

    if (!json?.success) {
      return null; 
    }

    return json.data;
  } catch (e) {
    console.error("[AR] Enrichment Fetch Error", e);
    throw new Error("api.activities.enrichmentFetchFailed");
  }
}