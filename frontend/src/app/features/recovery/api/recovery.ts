import { isoDate } from "@/app/shared/utils/time";
import {
  RecoveryRow,
  RecoveryPatch,
} from "@/app/features/recovery/types/recovery";
import { callBackend } from "@/app/shared/utils/callBackend";

export async function apiFetchRecovery(
  userId: string | number,
  days: number = 90,
): Promise<RecoveryRow[]> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/recovery/${encodeURIComponent(String(userId))}?days=${days}`;

  try {
    const json = await callBackend<any>(path, {
      method: "GET",
      cache: "no-store",
    });

    const arr: any[] = Array.isArray(json?.data) ? json.data : [];

    const normalized: RecoveryRow[] = arr
      .map((r) => {
        return {
          date: isoDate(r?.date),
          RHR_bpm: r?.RHR_bpm ?? null,
          HRV_avg_ms: r?.HRV_avg_ms ?? null,
          HRV_max_ms: r?.HRV_max_ms ?? null,
          sleep_start_time: r?.sleep_start_time ?? null,
          sleep_duration_min: r?.sleep_duration_min ?? null,
          comments: r?.comments ?? null,

          caffeine_8h: !!r?.caffeine_8h,
          food_2h_before: !!r?.food_2h_before,
          alcohol_consumed: !!r?.alcohol_consumed,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    return normalized;
  } catch (e) {
    console.error("[REC][api] fetch ERROR", e);
    throw new Error("api.recovery.fetchFailed");
  }
}

export async function apiSaveRecovery(
  userId: number,
  row: RecoveryRow,
): Promise<void> {
  const path = `/recovery`;

  try {
    await callBackend<any>(path, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...row,
        user_id: userId,
      }),
    });
  } catch (e) {
    console.error("[REC][api] save ERROR", e);
    throw new Error("api.recovery.saveFailed");
  }
}

export async function apiSaveRecoveryPatch(
  userId: number,
  patch: RecoveryPatch,
): Promise<void> {
  const path = `/recovery`;

  try {
    await callBackend<any>(path, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...patch,
        user_id: userId,
      }),
    });
  } catch (e) {
    console.error("[REC][api] save patch ERROR", e);
    throw new Error("api.recovery.saveFailed");
  }
}
