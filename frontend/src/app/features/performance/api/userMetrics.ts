import { callBackend } from "@/app/shared/utils/callBackend";

/** VO2 Max Measured (Latest) */
export async function apiGetVo2MeasuredLatest(userId: number) {
  return callBackend<any>(`/user-metrics/vo2-max/measured/latest?user_id=${userId}`, { method: "GET" });
}

/** VO2 Max Measured (Trend) */
export async function apiGetVo2MeasuredTrend(userId: number, days = 90) {
  return callBackend<any>(`/user-metrics/vo2-max/measured/trend?user_id=${userId}&days=${days}`, { method: "GET" });
}

/** VO2 Max Estimated (Latest) */
export async function apiGetVo2EstimatedLatest(userId: number) {
  return callBackend<any>(`/user-metrics/vo2-max/estimated/latest?user_id=${userId}`, { method: "GET" });
}

/** VO2 Max Estimated (Trend) */
export async function apiGetVo2EstimatedTrend(userId: number) {
  return callBackend<any>(`/user-metrics/vo2-max/estimated/trend?user_id=${userId}`, { method: "GET" });
}

/** Body Fat (Latest) */
export async function apiGetBodyFatLatest(userId: number) {
  return callBackend<any>(`/user-metrics/body-fat/latest?user_id=${userId}`, { method: "GET" });
}

/** Body Fat (Trend) */
export async function apiGetBodyFatTrend(userId: number) {
  return callBackend<any>(`/user-metrics/body-fat/trend?user_id=${userId}`, { method: "GET" });
}

/** Uložiť akúkoľvek metriku */
export async function apiSaveMetric(userId: number, metric: string, value: number) {
  return callBackend<any>(`/user-metrics/${userId}/${metric}?value=${value}`, { method: "POST" });
}