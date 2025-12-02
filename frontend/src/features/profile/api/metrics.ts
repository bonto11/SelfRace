// src/features/profile/api/metrics.ts
import { API_URL } from "@/shared/config";
import type {
  LatestMetricsMap,
  LatestMetricsResponse,
  MetricEntryInput,
  SaveMetricsSuccess,
  MetricsApiFail,
  MetricHistoryRow,
} from "@/features/profile/types/metricsTypes";

/** GET latest metrics */
export async function apiGetLatestMetrics(
  userId: number,
  userUid?: string | null
): Promise<LatestMetricsMap | null> {
  const qs = userUid ? `?user_uid=${encodeURIComponent(userUid)}` : "";
  const url = `${API_URL}/profile/metrics/latest/${userId}${qs}`;

  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json().catch(() => null)) as
    | LatestMetricsResponse
    | MetricsApiFail
    | null;

  if (!res.ok || !json || (json as MetricsApiFail).success === false) {
    return null;
  }

  return (json as LatestMetricsResponse).data ?? null;
}

/** POST save metrics */
export async function apiSaveMetrics(
  userId: number,
  entries: MetricEntryInput[],
  userUid?: string | null
): Promise<SaveMetricsSuccess> {
  const url = `${API_URL}/profile/metrics/${userId}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_uid: userUid ?? undefined,
      entries,
    }),
  });

  const json = (await res.json().catch(() => null)) as
    | SaveMetricsSuccess
    | MetricsApiFail
    | null;

  if (!res.ok || !json || (json as MetricsApiFail).success === false) {
    const msg = (json as MetricsApiFail)?.detail || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return json as SaveMetricsSuccess;
}

/** GET history of metric */
export async function apiGetMetricHistory(
  userId: number,
  metric: string,
  userUid?: string | null
): Promise<MetricHistoryRow[] | null> {
  const qsUser = userUid ? `&user_uid=${encodeURIComponent(userUid)}` : "";
  const url = `${API_URL}/profile/metrics/history/${userId}?metric=${encodeURIComponent(
    metric
  )}${qsUser}`;

  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => null);

  if (!res.ok || !json || json?.success === false || !Array.isArray(json.data)) {
    return null;
  }

  return json.data as MetricHistoryRow[];
}