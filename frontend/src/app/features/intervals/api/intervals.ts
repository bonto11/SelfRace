import { callBackend } from "@/app/shared/utils/callBackend";

// Voliteľná integrácia intervals.icu (BE: Modules/Intervals).
// error_code sa prekladá cez intervals.errors.<code>.

export type IntervalsStatus = {
  connected: boolean;
  /** plán sa automaticky posiela do kalendára intervals.icu (→ Garmin) */
  pushWorkouts: boolean;
  athleteId: string | null;
  lastSyncedAt: string | null;
  hasError: boolean;
};

export type IntervalsResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; errorCode: string };

const DISCONNECTED: IntervalsStatus = {
  connected: false,
  pushWorkouts: false,
  athleteId: null,
  lastSyncedAt: null,
  hasError: false,
};

export async function apiIntervalsStatus(userId: number): Promise<IntervalsStatus> {
  try {
    const json = await callBackend<any>(
      `/integrations/intervals/status/${encodeURIComponent(String(userId))}`,
      { method: "GET", cache: "no-store" },
    );
    const d = json?.data ?? {};
    if (!d.connected) return DISCONNECTED;
    return {
      connected: true,
      pushWorkouts: !!d.push_workouts,
      athleteId: d.athlete_id ?? null,
      lastSyncedAt: d.last_synced_at ?? null,
      hasError: !!d.has_error,
    };
  } catch {
    // Integrácia je voliteľná – chyba = ako nepripojené.
    return DISCONNECTED;
  }
}

async function post<T>(
  path: string,
  body: Record<string, unknown>,
  fallbackCode: string,
): Promise<IntervalsResult<T>> {
  try {
    const json = await callBackend<any>(path, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!json?.success) {
      return { ok: false, errorCode: String(json?.error_code || fallbackCode) };
    }
    return { ok: true, data: json?.data as T };
  } catch {
    return { ok: false, errorCode: fallbackCode };
  }
}

export function apiIntervalsConnect(
  userId: number,
  athleteId: string,
  apiKey: string,
): Promise<IntervalsResult<{ athlete_id: string }>> {
  return post(
    "/integrations/intervals/connect",
    { user_id: userId, athlete_id: athleteId, api_key: apiKey },
    "intervals_connect_failed",
  );
}

export function apiIntervalsDisconnect(userId: number): Promise<IntervalsResult> {
  return post(
    "/integrations/intervals/disconnect",
    { user_id: userId },
    "intervals_disconnect_failed",
  );
}

export function apiIntervalsSync(
  userId: number,
  days: number = 7,
): Promise<IntervalsResult<{ inserted: number; updated: number }>> {
  return post(
    "/integrations/intervals/sync",
    { user_id: userId, days },
    "intervals_sync_failed",
  );
}

export type IntervalsPushResult = { sent: number; removed: number; from: string; to: string };

/** Pošle plán na najbližšie dni do intervals.icu (odtiaľ do Garminu). */
export function apiIntervalsPush(userId: number, days: number = 14): Promise<IntervalsResult<IntervalsPushResult>> {
  return post("/integrations/intervals/push", { user_id: userId, days }, "intervals_push_failed");
}

/** Zapne/vypne automatické posielanie plánu; pri zapnutí BE plán pošle hneď. */
export function apiIntervalsPushSettings(
  userId: number,
  enabled: boolean,
): Promise<IntervalsResult<{ push_workouts: boolean; pushed: ({ ok: boolean; code?: string } & Partial<IntervalsPushResult>) | null }>> {
  return post(
    "/integrations/intervals/push-settings",
    { user_id: userId, enabled },
    "intervals_push_settings_failed",
  );
}
