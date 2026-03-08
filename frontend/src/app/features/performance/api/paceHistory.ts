// src/features/performance/api/paceHistory.ts
import { callBackend } from "@/app/shared/utils/callBackend";

/** * OPRAVA TYPOV: 
 * Pridali sme 'trends' a 'data' do ApiFail, aby catch bloky prešli cez TS 
 */
type ApiOkPace = { success: true; data: PaceHistoryData | null };
type ApiFail = { 
  success: false; 
  detail?: string; 
  trends?: never[]; // Pridané pre kompatibilitu v catch bloku
  data?: null;      // Pridané pre kompatibilitu v catch bloku
};

export type PaceHistoryData = {
  id?: number;
  user_id: number;
  measured_at: string;
  z1_pace_s?: number;
  z2_pace_s?: number;
  z3_pace_s?: number;
  z4_pace_s?: number;
  z5_pace_s?: number;
  best_1k_s?: number; // Pridané podľa logu
  est_5k_time_s?: number; // Pridané podľa logu (už sú to sekundy)
  est_10k_time_s?: number;
  est_half_marathon_time_s?: number;
  est_marathon_time_s?: number;
  source?: string;
};

// Zrušíme staré ApiOk/Fail typy a budeme vracať priamo to, čo sľubujeme

export async function apiGetLatestPaces(userId: number): Promise<{ success: boolean; data: PaceHistoryData | null }> {
  if (!userId) return { success: false, data: null };
  const path = `/user-paces/latest?user_id=${encodeURIComponent(String(userId))}`;

  try {
    const res = await callBackend<PaceHistoryData | null>(path, { method: "GET", cache: "no-store" });
    console.log("apiGetLatestPaces JSON:", res);
    
    // Ak backend vráti priamo objekt PaceHistoryData (má v sebe user_id)
    if (res && typeof res === 'object' && 'user_id' in res) {
        return { success: true, data: res };
    }
    return { success: false, data: null };
  } catch (e) {
    console.error("[paceHistory][GET latest] error", e);
    return { success: false, data: null };
  }
}

export async function apiGetPaceTrend(userId: number, days: number = 90): Promise<{ success: boolean; trends: PaceHistoryData[] }> {
  if (!userId) return { success: false, trends: [] };
  const path = `/user-paces/trend?user_id=${encodeURIComponent(String(userId))}&days=${days}`;

  try {
    const res = await callBackend<PaceHistoryData[] | any>(path, { method: "GET", cache: "no-store" });
    console.log("apiGetPaceTrend JSON:", res);
    
    // Ak backend vráti priamo pole
    if (Array.isArray(res)) {
        return { success: true, trends: res };
    }
    // Ak by backend vrátil nejaký zavinutý objekt { trends: [...] }
    if (res && res.trends && Array.isArray(res.trends)) {
        return { success: true, trends: res.trends };
    }
    return { success: false, trends: [] };
  } catch (e) {
    console.error("[paceHistory][GET trend] error", e);
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