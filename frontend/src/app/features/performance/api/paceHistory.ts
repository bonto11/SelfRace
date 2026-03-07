import { callBackend } from "@/app/shared/utils/callBackend";

/** * Hlavný typ pre záznam histórie temp a pretekových odhadov.
 * Exportujeme ho, aby ho mohol používať PerformanceDataProvider.
 */
export type PaceHistoryData = {
  id?: number;
  user_id: number;
  measured_at: string;
  // Tréningové tempá (sekundy na km)
  z1_pace_s?: number;
  z2_pace_s?: number;
  z3_pace_s?: number;
  z4_pace_s?: number;
  z5_pace_s?: number;
  // Odhadované časy na preteky (minúty)
  est_5k_time_min?: number;
  est_10k_time_min?: number;
  est_21k_time_min?: number;
  est_42k_time_min?: number;
  source?: string;
};

/** Interné typy pre odpovede z API */
type ApiOkPace = { success: true; data: PaceHistoryData | null };
type ApiOkPaceTrends = { success: true; trends: PaceHistoryData[] };
type ApiFail = { success: false; detail?: string };

/** * Načíta úplne najnovší záznam s tempami a odhadmi.
 * Používa sa pre hlavné widgety na Dashboarde.
 */
export async function apiGetLatestPaces(
  userId: number
): Promise<ApiOkPace | ApiFail> {
  if (!userId) return { success: false, detail: "Missing User ID" };
  
  const path = `/user-paces/latest?user_id=${encodeURIComponent(String(userId))}`;

  try {
    const res = await callBackend<ApiOkPace | ApiFail>(path, { 
      method: "GET", 
      cache: "no-store" 
    });
    return res ?? { success: false };
  } catch (e) {
    console.error("[paceHistory][GET latest] error", e);
    return { success: false };
  }
}

/** * Načíta pole historických záznamov pre grafy.
 * Days určuje, ako hlboko do minulosti ideme.
 */
export async function apiGetPaceTrend(
  userId: number,
  days: number = 90
): Promise<ApiOkPaceTrends | ApiFail> {
  if (!userId) return { success: false, detail: "Missing User ID" };

  const path = `/user-paces/trend?user_id=${encodeURIComponent(String(userId))}&days=${days}`;

  try {
    const res = await callBackend<ApiOkPaceTrends | ApiFail>(path, { 
      method: "GET", 
      cache: "no-store" 
    });
    return res ?? { success: false, trends: [] };
  } catch (e) {
    console.error("[paceHistory][GET trend] error", e);
    return { success: false, trends: [] };
  }
}

/** * Uloží nový riadok do histórie temp.
 * Väčšinou volané z backendu po AI analýze, ale dostupné aj pre FE.
 */
export async function apiSavePaceHistory(
  userId: number,
  payload: Partial<PaceHistoryData>
): Promise<ApiOkPace | ApiFail> {
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
    console.error("[paceHistory][POST] error", e);
    throw new Error("Failed to save pace history");
  }
}