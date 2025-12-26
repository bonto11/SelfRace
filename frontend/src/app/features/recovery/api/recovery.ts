// src/features/recovery/api/recovery.ts
import { isoDate } from "@/app/shared/utils/time";
import { RecoveryRow } from "@/app/features/recovery/types/recovery";
import { callBackend } from "@/app/shared/utils/callBackend";

/**
 * Čistý BE fetch + normalizácia na RecoveryRow[]
 * Žiadna cache, žiadne React veci.
 */
export async function fetchRecoveryApi(
  userId: string | number,
  days: number = 90
): Promise<RecoveryRow[]> {
  if (!userId) return [];

  const path = `/recovery/${encodeURIComponent(String(userId))}?days=${days}`;
  console.debug("[RECovery][api] ->", path);

  try {
    const json = await callBackend<any>(path, {
      method: "GET",
      cache: "no-store",
    });

    const arr: any[] = Array.isArray(json?.data) ? json.data : [];

    const normalized: RecoveryRow[] = arr
      .map((r) => ({
        date: isoDate(r?.date),
        RHR_bpm: r?.RHR_bpm ?? null,
        HRV_avg_ms: r?.HRV_avg_ms ?? null,
        HRV_max_ms: r?.HRV_max_ms ?? null,
        sleep_start_time: r?.sleep_start_time ?? null,
        sleep_duration_min: r?.sleep_duration_min ?? null,
        comments: r?.comments ?? null,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return normalized;
  } catch (e) {
    console.error("[REC][api] fetch ERROR", e);
    return [];
  }
}