import { callBackend } from "@/app/shared/utils/callBackend";

type ApiFail = { success: false; detail?: string };

/** VO2 Max Measured (Latest) */
export async function apiGetVo2MeasuredLatest(userId: number) {
  if (!userId) return null;
  const path = `/user-metrics/vo2-max/measured/latest?user_id=${encodeURIComponent(String(userId))}`;

  try {
    const json = await callBackend<any>(path, { method: "GET", cache: "no-store" });
    console.log("apiGetVo2MeasuredLatest json", json);

    if (!json || (json as ApiFail).success === false) return null;
    return json;
  } catch (e) {
    console.error("[userMetrics][GET vo2 measured latest] error", e);
    return null;
  }
}

/** VO2 Max Measured (Trend) */
export async function apiGetVo2MeasuredTrend(userId: number, days = 90) {
  if (!userId) return null;
  const path = `/user-metrics/vo2-max/measured/trend?user_id=${encodeURIComponent(String(userId))}&days=${days}`;

  try {
    const json = await callBackend<any>(path, { method: "GET", cache: "no-store" });
    console.log("apiGetVo2MeasuredTrend json", json);

    if (!json || (json as ApiFail).success === false) return null;
    return json;
  } catch (e) {
    console.error("[userMetrics][GET vo2 measured trend] error", e);
    return null;
  }
}

/** VO2 Max Estimated (Latest) */
export async function apiGetVo2EstimatedLatest(userId: number) {
  if (!userId) return null;
  const path = `/user-metrics/vo2-max/estimated/latest?user_id=${encodeURIComponent(String(userId))}`;

  try {
    const json = await callBackend<any>(path, { method: "GET", cache: "no-store" });
    console.log("apiGetVo2EstimatedLatest json", json);

    if (!json || (json as ApiFail).success === false) return null;
    return json;
  } catch (e) {
    console.error("[userMetrics][GET vo2 estimated latest] error", e);
    return null;
  }
}

/** VO2 Max Estimated (Trend) */
export async function apiGetVo2EstimatedTrend(userId: number, days = 90) {
  if (!userId) return null;
  const path = `/user-metrics/vo2-max/estimated/trend?user_id=${encodeURIComponent(String(userId))}&days=${days}`;

  try {
    const json = await callBackend<any>(path, { method: "GET", cache: "no-store" });
    console.log("apiGetVo2EstimatedTrend json", json);

    if (!json || (json as ApiFail).success === false) return null;
    return json;
  } catch (e) {
    console.error("[userMetrics][GET vo2 estimated trend] error", e);
    return null;
  }
}

/** Body Fat (Latest) */
export async function apiGetBodyFatLatest(userId: number) {
  if (!userId) return null;
  const path = `/user-metrics/body-fat/latest?user_id=${encodeURIComponent(String(userId))}`;

  try {
    const json = await callBackend<any>(path, { method: "GET", cache: "no-store" });
    console.log("apiGetBodyFatLatest json", json);

    if (!json || (json as ApiFail).success === false) return null;
    return json;
  } catch (e) {
    console.error("[userMetrics][GET body fat latest] error", e);
    return null;
  }
}

/** Body Fat (Trend) */
export async function apiGetBodyFatTrend(userId: number, days = 90) {
  if (!userId) return null;
  const path = `/user-metrics/body-fat/trend?user_id=${encodeURIComponent(String(userId))}&days=${days}`;

  try {
    const json = await callBackend<any>(path, { method: "GET", cache: "no-store" });
    console.log("apiGetBodyFatTrend json", json);

    if (!json || (json as ApiFail).success === false) return null;
    return json;
  } catch (e) {
    console.error("[userMetrics][GET body fat trend] error", e);
    return null;
  }
}

/** Weight (Latest) - Pridané pre čistotu komponentu */
export async function apiGetWeightLatest(userId: number) {
  if (!userId) return null;
  const path = `/user-metrics/latest/${encodeURIComponent(String(userId))}?metric=weight_kg`;

  try {
    const json = await callBackend<any>(path, { method: "GET", cache: "no-store" });
    console.log("apiGetWeightLatest json", json);

    if (!json || (json as ApiFail).success === false) return null;
    return json;
  } catch (e) {
    console.error("[userMetrics][GET weight latest] error", e);
    return null;
  }
}

/** HR Max (Latest) - Pridané pre čistotu komponentu */
export async function apiGetHrMaxLatest(userId: number) {
  if (!userId) return null;
  const path = `/user-metrics/latest/${encodeURIComponent(String(userId))}?metric=HR_max`;

  try {
    const json = await callBackend<any>(path, { method: "GET", cache: "no-store" });
    console.log("apiGetHrMaxLatest json", json);

    if (!json || (json as ApiFail).success === false) return null;
    return json;
  } catch (e) {
    console.error("[userMetrics][GET hrmax latest] error", e);
    return null;
  }
}

/** Uložiť akúkoľvek metriku */
export async function apiSaveMetric(userId: number, metric: string, value: number) {
  if (!userId) throw new Error("api.common.missingUserAuth");
  const path = `/user-metrics/${encodeURIComponent(String(userId))}/${encodeURIComponent(metric)}?value=${encodeURIComponent(String(value))}`;

  try {
    const json = await callBackend<any>(path, { method: "POST", cache: "no-store" });
    console.log("apiSaveMetric json", json);

    if (!json || (json as ApiFail).success === false) {
      throw new Error((json as ApiFail)?.detail || "Failed to save metric");
    }
    return json;
  } catch (e) {
    console.error("[userMetrics][POST save metric] error", e);
    throw e; // Hádžeme ďalej, aby FE komponenty (napr. Toast) vedeli, že to zlyhalo
  }
}