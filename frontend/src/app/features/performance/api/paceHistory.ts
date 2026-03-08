// src/features/performance/api/paceHistory.ts
import { callBackend } from "@/app/shared/utils/callBackend";

export type PaceHistoryData = {
  id?: number;
  user_id: number;
  measured_at: string;
  z1_pace_s?: number;
  z2_pace_s?: number;
  z3_pace_s?: number;
  z4_pace_s?: number;
  z5_pace_s?: number;
  best_1k_s?: number;
  est_5k_time_s?: number;
  est_10k_time_s?: number;
  est_half_marathon_time_s?: number;
  est_marathon_time_s?: number;
  source?: string;
};

export async function apiGetLatestPaces(userId: number) {
  if (!userId) return { success: false, data: null };
  const path = `/user-paces/latest?user_id=${encodeURIComponent(String(userId))}`;

  try {
    const res = await callBackend<any>(path, { method: "GET", cache: "no-store" });
    
    // Backend vracia { success: true, data: { ... } }, prepustíme to tak ako to je
    if (res && res.success) {
        return { success: true, data: res.data };
    }
    return { success: false, data: null };
  } catch (e) {
    console.error("[paceHistory][GET latest] error", e);
    return { success: false, data: null };
  }
}

export async function apiGetPaceTrend(userId: number, days: number = 90) {
  if (!userId) return { success: false, trends: [] };
  const path = `/user-paces/trend?user_id=${encodeURIComponent(String(userId))}&days=${days}`;

  try {
    const res = await callBackend<any>(path, { method: "GET", cache: "no-store" });
    
    // Backend vracia { success: true, trends: [ ... ] }, prepustíme to tak ako to je
    if (res && res.success) {
        return { success: true, trends: res.trends };
    }
    return { success: false, trends: [] };
  } catch (e) {
    console.error("[paceHistory][GET trend] error", e);
    return { success: false, trends: [] };
  }
}

export async function apiSavePaceHistory(userId: number, payload: Partial<PaceHistoryData>) {
  if (!userId) throw new Error("api.common.missingUserAuth");
  const path = `/user-paces/${encodeURIComponent(String(userId))}`;
  try {
    const res = await callBackend<any>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
    });
    return res ?? { success: false };
  } catch (e) {
    throw new Error("Failed to save pace history");
  }
}