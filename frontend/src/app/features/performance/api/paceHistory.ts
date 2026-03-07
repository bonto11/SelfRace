// src/features/performance/api/paceHistory.ts (alebo v inej vhodnej ceste)
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

type ApiOkPace = { success: true; data: PaceHistoryData | null };
type ApiOkPaceTrends = { success: true; trends: PaceHistoryData[] };
type ApiFail = { success: false; detail?: string };

/** Načíta úplne najnovší záznam s tempami a odhadmi */
export async function apiFetchLatestPaceHistory(
  userId: number
): Promise<PaceHistoryData | null> {
  if (!userId) return null;
  const path = `/users_pace_history/${encodeURIComponent(String(userId))}`;

  try {
    const json = await callBackend<ApiOkPace | ApiFail>(path, { method: "GET", cache: "no-store" });
    if (!json || (json as ApiFail).success === false) return null;
    return (json as ApiOkPace).data ?? null;
  } catch (e) {
    console.error("[paceHistory][GET latest] error", e);
    return null;
  }
}

/** Načíta pole historických záznamov pre grafy (napr. vývoj 5k v čase) */
export async function apiFetchPaceHistoryTrends(
  userId: number,
  days: number = 90
): Promise<PaceHistoryData[]> {
  if (!userId) return [];
  const path = `/users_pace_history/trends/${encodeURIComponent(String(userId))}?days=${days}`;

  try {
    const json = await callBackend<ApiOkPaceTrends | ApiFail>(path, { method: "GET", cache: "no-store" });

    console.log("apiFetchPaceHistoryTrends json", json)

    if (!json || (json as ApiFail).success === false) return [];
    return (json as ApiOkPaceTrends).trends || [];
  } catch (e) {
    console.error("[paceHistory][GET trends] error", e);
    return [];
  }
}

/** (Pre FE väčšinou nepotrebné volať priamo, keďže toto zapisuje Backend AI, ale nech je to tu) */
export async function apiSavePaceHistory(
  userId: number,
  payload: Partial<PaceHistoryData>
): Promise<PaceHistoryData | null> {
  if (!userId) throw new Error("api.common.missingUserAuth");
  const path = `/users_pace_history/${encodeURIComponent(String(userId))}`;

  try {
    const json = await callBackend<ApiOkPace | ApiFail>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
    });

    if (!json || (json as ApiFail)?.success === false) throw new Error("Failed to save pace history");
    return (json as ApiOkPace).data ?? null;
  } catch (e) {
    console.error("[paceHistory][POST] error", e);
    throw e;
  }
}
