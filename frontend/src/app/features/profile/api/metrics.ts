// src/features/profile/api/metrics.ts
import { callBackend } from "@/app/shared/utils/callBackend";
import type {
  LatestMetricsMap,
  LatestMetricsResponse,
  MetricEntryInput,
  SaveMetricsSuccess,
  MetricsApiFail,
  MetricHistoryRow,
} from "@/app/features/profile/types/profile";

/**
 * GET latest metrics
 * - BE identifikuje usera cez JWT + path param user_id
 * - žiadny user_uid už netreba
 */
export async function apiGetLatestMetrics(
  userId: number
): Promise<LatestMetricsMap | null> {
  if (!userId) return null;

  const path = `/profile/metrics/latest/${encodeURIComponent(String(userId))}`;
  console.debug("[METRICS][apiGetLatestMetrics] ->", path);

  try {
    const json = await callBackend<LatestMetricsResponse | MetricsApiFail>(path, {
      method: "GET",
      cache: "no-store",
    });

    if (!json || (json as MetricsApiFail).success === false) {
      return null;
    }

    return (json as LatestMetricsResponse).data ?? null;
  } catch (e) {
    console.error("[METRICS][apiGetLatestMetrics] ERROR", e);
    return null;
  }
}

/**
 * POST save metrics
 * - telo: { entries: [...] }
 * - user_uid už neposielame, BE si user identifikuje z JWT
 */
export async function apiSaveMetrics(
  userId: number,
  entries: MetricEntryInput[]
): Promise<SaveMetricsSuccess> {
  if (!userId) {
    throw new Error("Missing userId in apiSaveMetrics");
  }

  const path = `/profile/metrics/${encodeURIComponent(String(userId))}`;
  console.debug("[METRICS][apiSaveMetrics] ->", path, "entries:", entries?.length);

  try {
    const json = await callBackend<SaveMetricsSuccess | MetricsApiFail>(path, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        entries,
      }),
    });

    if (!json || (json as MetricsApiFail).success === false) {
      const msg =
        (json as MetricsApiFail)?.detail || "[METRICS] apiSaveMetrics failed";
      throw new Error(msg);
    }

    return json as SaveMetricsSuccess;
  } catch (e) {
    console.error("[METRICS][apiSaveMetrics] ERROR", e);
    throw e;
  }
}

/**
 * GET history of metric
 * - query: ?metric=...
 * - user_uid už nie, JWT + user_id stačia
 */
export async function apiGetMetricHistory(
  userId: number,
  metric: string
): Promise<MetricHistoryRow[] | null> {
  if (!userId || !metric) return null;

  const path = `/profile/metrics/history/${encodeURIComponent(
    String(userId)
  )}?metric=${encodeURIComponent(metric)}`;

  console.debug("[METRICS][apiGetMetricHistory] ->", path);

  try {
    const json = await callBackend<any>(path, {
      method: "GET",
      cache: "no-store",
    });

    if (!json || json?.success === false || !Array.isArray(json.data)) {
      return null;
    }

    return json.data as MetricHistoryRow[];
  } catch (e) {
    console.error("[METRICS][apiGetMetricHistory] ERROR", e);
    return null;
  }
}