import { callBackend } from "@/app/shared/utils/callBackend";

// Voliteľná integrácia intervals.icu (BE: Modules/Intervals).
// error_code sa prekladá cez recovery.intervals.errors.<code>.

export type IntervalsSyncResult =
  | { ok: true; inserted: number; updated: number }
  | { ok: false; errorCode: string };

export async function apiIntervalsStatus(userId: number): Promise<boolean> {
  try {
    const json = await callBackend<any>(
      `/integrations/intervals/status/${encodeURIComponent(String(userId))}`,
      { method: "GET", cache: "no-store" },
    );
    return !!json?.data?.enabled;
  } catch {
    // Integrácia je voliteľná – chyba = tlačidlo sa nezobrazí.
    return false;
  }
}

export async function apiIntervalsSync(
  userId: number,
  days: number = 7,
): Promise<IntervalsSyncResult> {
  try {
    const json = await callBackend<any>(`/integrations/intervals/sync`, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: userId, days }),
    });
    if (!json?.success) {
      return { ok: false, errorCode: String(json?.error_code || "intervals_sync_failed") };
    }
    return {
      ok: true,
      inserted: Number(json?.data?.inserted ?? 0),
      updated: Number(json?.data?.updated ?? 0),
    };
  } catch {
    return { ok: false, errorCode: "intervals_sync_failed" };
  }
}
