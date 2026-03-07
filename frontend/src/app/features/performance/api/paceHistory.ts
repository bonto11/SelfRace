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
  est_5k_time_min?: number;
  est_10k_time_min?: number;
  est_21k_time_min?: number;
  est_42k_time_min?: number;
  source?: string;
};

/** * OPRAVA TYPOV: 
 * Pridali sme 'trends' a 'data' do ApiFail, aby catch bloky prešli cez TS 
 */
type ApiOkPace = { success: true; data: PaceHistoryData | null };
type ApiOkPaceTrends = { success: true; trends: PaceHistoryData[] };
type ApiFail = { 
  success: false; 
  detail?: string; 
  trends?: never[]; // Pridané pre kompatibilitu v catch bloku
  data?: null;      // Pridané pre kompatibilitu v catch bloku
};

export async function apiGetLatestPaces(userId: number): Promise<ApiOkPace | ApiFail> {
  if (!userId) return { success: false, detail: "Missing User ID", data: null };
  const path = `/user-paces/latest?user_id=${encodeURIComponent(String(userId))}`;

  try {
    const res = await callBackend<ApiOkPace | ApiFail>(path, { method: "GET", cache: "no-store" });
    return res ?? { success: false, data: null };
  } catch (e) {
    return { success: false, data: null };
  }
}

export async function apiGetPaceTrend(userId: number, days: number = 90): Promise<ApiOkPaceTrends | ApiFail> {
  if (!userId) return { success: false, detail: "Missing User ID", trends: [] };
  const path = `/user-paces/trend?user_id=${encodeURIComponent(String(userId))}&days=${days}`;

  try {
    const res = await callBackend<ApiOkPaceTrends | ApiFail>(path, { method: "GET", cache: "no-store" });
    return res ?? { success: false, trends: [] };
  } catch (e) {
    // TENTO RIADOK TERAZ PREJDE:
    return { success: false, trends: [] };
  }
}

export async function apiSavePaceHistory(userId: number, payload: Partial<PaceHistoryData>): Promise<ApiOkPace | ApiFail> {
  if (!userId) throw new Error("api.common.missingUserAuth");
  const path = `/user-paces/${encodeURIComponent(String(userId))}`;
  try {
    const res = await callBackend<ApiOkPace | ApiFail>(path, {
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