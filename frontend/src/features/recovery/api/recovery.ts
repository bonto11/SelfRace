// src/features/recovery/api/recovery.ts
import { API_URL } from "@/shared/config";
import { isoDate } from "@/shared/utils/time";
import { RecoveryRow } from "@/features/recovery/types/recovery";

/**
 * Čistý BE fetch + normalizácia na RecoveryRow[]
 * Žiadna cache, žiadne React veci.
 */
export async function fetchRecoveryApi(
  userId: string,
  days: number = 90
): Promise<RecoveryRow[]> {
  if (!userId) return [];

  const url = `${API_URL}/recovery/${userId}?days=${days}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[REC][api] HTTP error", {
        url,
        status: res.status,
        statusText: res.statusText,
      });
      return [];
    }

    let json: any;
    try {
      json = await res.json();
    } catch (e) {
      console.error("[REC][api] JSON parse error", e);
      return [];
    }

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