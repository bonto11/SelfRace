// src/features/performance/api/metrics.ts
import { callBackend } from "@/app/shared/utils/callBackend";
import type {
  LatestMetricsMap,
  LatestMetricsResponse,
  MetricEntryInput,
  SaveMetricsSuccess,
  MetricsApiFail,
  MetricHistoryRow,
  HistoryRow,
  EstRow,
  Vo2HistoryApiOk,
  Vo2EstimateApiOk,
} from "@/app/features/performance/types/performance";

/**
 * GET latest metrics
 * - BE identifikuje usera cez JWT + path param user_id
 * - žiadny user_uid už netreba
 */
export async function apiGetLatestMetrics(
  userId: number,
): Promise<LatestMetricsMap | null> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/profile/metrics/latest/${encodeURIComponent(String(userId))}`;

  try {
    const json = await callBackend<LatestMetricsResponse | MetricsApiFail>(
      path,
      {
        method: "GET",
        cache: "no-store",
      },
    );

    console.log("apiGetLatestMetrics json", json)

    if (!json || (json as MetricsApiFail).success === false) {
      return null;
    }

    return (json as LatestMetricsResponse).data ?? null;
  } catch (e) {
    console.error("[METRICS][apiGetLatestMetrics] ERROR", e);
    throw new Error("api.performance.metricsLoadFailed");
  }
}

/**
 * GET VO2 history + meta (sex, birth_date)
 */
export async function apiGetVo2History(
  userId: number,
): Promise<Vo2HistoryApiOk | null> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/profile/vo2-history/${encodeURIComponent(String(userId))}`;

  try {
    const json = await callBackend<any>(path, {
      method: "GET",
      cache: "no-store",
    });

    console.log("apiGetVo2History json", json)

    if (!json || json.success === false) {
      return null;
    }

    const history: HistoryRow[] = Array.isArray(json.history)
      ? (json.history as HistoryRow[])
      : [];

    const sex: "M" | "F" | null =
      json.sex === "F" ? "F" : json.sex === "M" ? "M" : null;

    const birth_date: string | null = json.birth_date ?? null;

    return {
      success: true,
      history,
      sex,
      birth_date,
    };
  } catch (e) {
    console.error("[METRICS][apiGetVo2History] ERROR", e);
    throw new Error("api.performance.vo2LoadFailed");
  }
}

/**
 * GET VO2 estimate
 */
export async function apiGetVo2Estimate(
  userId: number,
): Promise<EstRow | null> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/profile/vo2-estimate/${encodeURIComponent(String(userId))}`;

  try {
    const json = await callBackend<Vo2EstimateApiOk | MetricsApiFail | null>(
      path,
      {
        method: "GET",
        cache: "no-store",
      },
    );

    console.log("apiGetVo2Estimate json", json)

    if (!json || (json as any).success === false) {
      return null;
    }

    // BE vracia { success, value, updated_at } – to vieš mapnúť priamo na EstRow
    return {
      value: (json as Vo2EstimateApiOk).value ?? null,
      updated_at: (json as Vo2EstimateApiOk).updated_at ?? null,
    } as EstRow;
  } catch (e) {
    console.error("[METRICS][apiGetVo2Estimate] ERROR", e);
    throw new Error("api.performance.vo2LoadFailed");
  }
}

/**
 * POST save metrics
 * - telo: { entries: [...] }
 * - user_uid už neposielame, BE si user identifikuje z JWT
 */
export async function apiSaveMetrics(
  userId: number,
  entries: MetricEntryInput[],
): Promise<SaveMetricsSuccess> {
  if (!userId) {
    throw new Error("api.common.missingUserAuth");
  }

  const path = `/profile/metrics/${encodeURIComponent(String(userId))}`;

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
      throw new Error("api.performance.metricsSaveFailed");
    }

    return json as SaveMetricsSuccess;
  } catch (e) {
    console.error("[METRICS][apiSaveMetrics] ERROR", e);
    throw new Error("api.performance.metricsSaveFailed");
  }
}

/**
 * GET history of metric
 * - query: ?metric=...
 * - user_uid už nie, JWT + user_id stačia
 */
export async function apiGetMetricHistory(
  userId: number,
  metric: string,
): Promise<MetricHistoryRow[] | null> {
  if (!userId || !metric) throw new Error("api.common.missingUserAuth");

  const path = `/profile/metrics/history/${encodeURIComponent(
    String(userId),
  )}?metric=${encodeURIComponent(metric)}`;

  try {
    const json = await callBackend<any>(path, {
      method: "GET",
      cache: "no-store",
    });

    console.log("apiGetMetricHistory json", json)

    if (!json || json?.success === false || !Array.isArray(json.data)) {
      return null;
    }

    return json.data as MetricHistoryRow[];
  } catch (e) {
    console.error("[METRICS][apiGetMetricHistory] ERROR", e);
    throw new Error("api.performance.metricsLoadFailed");
  }
}
