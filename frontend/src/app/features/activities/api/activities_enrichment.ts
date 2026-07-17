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

/* ─── ROUTE MATCH (pomenované trate) ─── */

export type RouteMatchOptions = {
  ok: boolean;
  sport: string;
  auto_match: string | null;
  current_match: string | null;
  existing_route_names: string[];
  distance_m: number | null;
  elevation_gain_m: number | null;
};

export async function apiGetRouteMatchOptions(
  userId: number,
  activityId: number,
): Promise<RouteMatchOptions | null> {
  if (!userId || !activityId) return null;

  const path = `/activities/enrichment/route-match/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(activityId))}/options`;

  try {
    const json = await callBackend<any>(path, {
      method: "GET",
      cache: "no-store",
    });
    return json?.success ? (json.data as RouteMatchOptions) : null;
  } catch (e) {
    console.error("[RouteMatch] Options Fetch Error", e);
    return null;
  }
}

export async function apiConfirmRouteMatch(
  userId: number,
  activityId: number,
  routeName: string,
): Promise<{ success: boolean; route_match?: string; error_code?: string }> {
  if (!userId || !activityId) throw new Error("api.activities.missingActivityId");

  const path = `/activities/enrichment/route-match/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(activityId))}/confirm`;

  try {
    const json = await callBackend<any>(path, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ route_name: routeName }),
    });

    if (!json?.success) {
      return { success: false, error_code: json?.error_code || "REQUEST_FAILED" };
    }
    return { success: true, route_match: json.data?.route_match };
  } catch (e) {
    console.error("[RouteMatch] Confirm Error", e);
    return { success: false, error_code: "network_error" };
  }
}

export async function apiRejectRouteAutoMatch(
  userId: number,
  activityId: number,
): Promise<boolean> {
  if (!userId || !activityId) return false;

  const path = `/activities/enrichment/route-match/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(activityId))}/reject-suggestion`;

  try {
    const json = await callBackend<any>(path, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });
    return !!json?.success;
  } catch (e) {
    console.error("[RouteMatch] Reject Error", e);
    return false;
  }
}

export async function apiRemoveRouteMatch(
  userId: number,
  activityId: number,
): Promise<boolean> {
  if (!userId || !activityId) return false;

  const path = `/activities/enrichment/route-match/${encodeURIComponent(String(userId))}/${encodeURIComponent(String(activityId))}/remove`;

  try {
    const json = await callBackend<any>(path, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });
    return !!json?.success;
  } catch (e) {
    console.error("[RouteMatch] Remove Error", e);
    return false;
  }
}

export async function apiListRouteNames(
  userId: number,
  sport: string,
): Promise<string[]> {
  if (!userId || !sport) return [];

  const path = `/activities/enrichment/route-match/${encodeURIComponent(String(userId))}/names?sport=${encodeURIComponent(sport)}`;

  try {
    const json = await callBackend<any>(path, {
      method: "GET",
      cache: "no-store",
    });
    return json?.success && Array.isArray(json.data) ? json.data : [];
  } catch (e) {
    console.error("[RouteMatch] List Names Error", e);
    return [];
  }
}

export type RouteOverviewEntry = {
  route_match: string;
  sport_type_fe: string | null;
  count: number;
  last_activity_at: string | null;
};

export async function apiGetRouteOverview(
  userId: number,
): Promise<RouteOverviewEntry[]> {
  if (!userId) return [];

  const path = `/activities/enrichment/route-match/${encodeURIComponent(String(userId))}/overview`;

  try {
    const json = await callBackend<any>(path, {
      method: "GET",
      cache: "no-store",
    });
    return json?.success && Array.isArray(json.data?.routes) ? json.data.routes : [];
  } catch (e) {
    console.error("[RouteMatch] Overview Fetch Error", e);
    return [];
  }
}

export type RouteMatchComparison = {
  ok: boolean;
  route_match: string;
  activities: Array<{
    activity_id: number;
    route_match: string;
    distance_m: number | null;
    elevation_gain_m: number | null;
    moving_time_s: number | null;
    avg_hr_bpm: number | string | null;
    average_speed_mps: number | null;
    sport_type_fe: string | null;
    updated_at: string | null;
  }>;
  stats: {
    count: number;
    median_distance_m: number | null;
    median_elevation_gain_m: number | null;
    best_time_s: number | null;
  };
};

export async function apiCompareRouteMatch(
  userId: number,
  routeMatch: string,
): Promise<RouteMatchComparison | null> {
  if (!userId || !routeMatch) return null;

  const path = `/activities/enrichment/route-match/${encodeURIComponent(String(userId))}/compare?route_match=${encodeURIComponent(routeMatch)}`;

  try {
    const json = await callBackend<any>(path, {
      method: "GET",
      cache: "no-store",
    });
    return json?.success ? (json.data as RouteMatchComparison) : null;
  } catch (e) {
    console.error("[RouteMatch] Compare Error", e);
    return null;
  }
}