// src/app/features/activities/api/activities_enrichment.ts
import { callBackend } from "@/app/shared/utils/callBackend";
import type {
  ActivityReviewRerunResponse,
  ActivityEnrichment
} from "@/app/features/activities/types/activities_enrichment";

export async function apiRerunActivityReview(
  userId: number,
  activityId: number,
  opts: { comment?: string | null; model?: string | null; has_new_injury?: boolean; is_race_effort?: boolean } // ✅ Pridané is_race_effort
): Promise<ActivityReviewRerunResponse | any> {
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
    throw new Error("api.activities.enqueueFailed");
  }

  if (!enqueueJson?.ok) {
    return enqueueJson;
  }

  const jobId = enqueueJson.job_id;
  if (!jobId) {
    return { success: true, ok: true, status: "QUEUED" };
  }

  const runPath = `/jobs/run/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(jobId))}`;

  try {
    const runJson = await callBackend<any>(runPath, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });

    if (!runJson?.success) {
      console.warn("[AR] Sync Run Failed/Timeout", runJson);
      return { success: true, ok: true, status: "PROCESSING" };
    }

    return { success: true, ok: true, status: "SUCCESS" };

  } catch (e) {
    console.error("[AR] Sync Run Network Error", e);
    return { success: true, ok: true, status: "QUEUED" };
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