// app/features/strava/api/strava.ts
import { callBackend } from "@/app/shared/utils/callBackend";

/**
 * StravaStatus – dopredu kompatibilné:
 * - connected: bool
 * - athlete_id: number|null
 * - scopes: string[]
 * - expires_at: ISO string | null
 * - disconnected_at: ISO string | null
 * - reconnect_after: ISO string | null
 * - can_connect: bool | null
 * - can_manual_import: bool | null
 * - sync_import_window_days?: number | null;
 * - sync_import_max_activities?: number | null;
 */
export type StravaStatus = {
  connected: boolean;
  athlete_id: number | null;
  scopes: string[];
  expires_at: string | null;

  disconnected_at?: string | null;
  reconnect_after?: string | null;
  can_connect?: boolean | null;
  can_manual_import?: boolean | null;
  sync_import_window_days?: number | null;
  sync_import_max_activities?: number | null;
};

export type DisconnectPayload = {
  consent: boolean;
  reason?: "user_request" | string;
};

export type DisconnectResult = {
  ok: boolean;
  disconnected_at?: string | null;
  reconnect_after?: string | null;
  purge?: any;

  // ✅ nové (pre dry-run debug)
  dry_run?: boolean;
  plan?: any;
};

export type ImportLimits = {
  manual_window_days: number;
  reconnect_after?: string | null;
};

/* ========================================================================= */

function enc(v: any) {
  return encodeURIComponent(String(v));
}

// ✅ DÔLEŽITÉ: BE má prefix /api/strava
const STRAVA_BASE = "/api/strava";

export async function apiGetStravaStatus(userId: number): Promise<StravaStatus> {
  if (!userId) throw new Error("Missing userId in apiGetStravaStatus");

  const path = `${STRAVA_BASE}/status?user_id=${enc(userId)}`;
  console.debug("[Strava][apiGetStravaStatus] ->", path);

  try {
    const json = await callBackend<any>(path, {
      method: "GET",
      cache: "no-store",
    });

    return {
      connected: !!json?.connected,
      athlete_id: typeof json?.athlete_id === "number" ? json.athlete_id : null,
      scopes: Array.isArray(json?.scopes) ? json.scopes : [],
      expires_at: json?.expires_at ?? null,

      disconnected_at: json?.disconnected_at ?? null,
      reconnect_after: json?.reconnect_after ?? null,
      can_connect: typeof json?.can_connect === "boolean" ? json.can_connect : null,
      can_manual_import:
        typeof json?.can_manual_import === "boolean" ? json.can_manual_import : null,
      sync_import_window_days:
        typeof json?.sync_import_window_days === "number" ? json.sync_import_window_days : null,
      sync_import_max_activities:
        typeof json?.sync_import_max_activities === "number" ? json.sync_import_max_activities : null,
        };
  } catch (e: any) {
    console.error("[Strava][apiGetStravaStatus] ERROR", e);
    const msg =
      e instanceof Error
        ? e.message
        : "Failed to load Strava status (apiGetStravaStatus)";
    throw new Error(msg);
  }
}

export type DisconnectOptions = {
  /**
   * Ak true, BE iba vráti plán (nič neodpojí, nič nevymaže).
   * Implementované cez query param: dry_run=1
   */
  dryRun?: boolean;
};

export async function apiDisconnectStrava(
  userId: number,
  payload: DisconnectPayload,
  opts?: DisconnectOptions
): Promise<DisconnectResult> {
  if (!userId) throw new Error("Missing userId in apiDisconnectStrava");
  if (!payload?.consent) throw new Error("Consent is required to disconnect Strava");

  const qs = new URLSearchParams();
  qs.set("user_id", String(userId));
  if (opts?.dryRun) qs.set("dry_run", "1");

  const path = `${STRAVA_BASE}/disconnect?${qs.toString()}`;
  console.debug("[Strava][apiDisconnectStrava] ->", path, "payload:", payload);

  try {
    const json = await callBackend<any>(path, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    return {
      ok: !!json?.ok,

      // ✅ real-run: disconnect endpoint vracia account_update.deauthorized_at
      // ✅ dry-run: vracia plan.would_set_deauthorized_at
      disconnected_at:
        json?.disconnected_at ??
        json?.account_update?.deauthorized_at ??
        json?.plan?.would_set_deauthorized_at ??
        null,

      reconnect_after: json?.reconnect_after ?? null,
      purge: json?.purge ?? null,

      // ✅ dry-run debug
      dry_run: json?.dry_run ?? false,
      plan: json?.plan ?? null,
    };
  } catch (e: any) {
    console.error("[Strava][apiDisconnectStrava] ERROR", e);
    const msg =
      e instanceof Error
        ? e.message
        : "Failed to disconnect Strava (apiDisconnectStrava)";
    throw new Error(msg);
  }
}

/**
 * FE skladanie URL na connect flow – nech je to na jednom mieste.
 * (BE je Redirect endpoint)
 */
export function getStravaConnectUrl(userId: number, apiUrl: string): string {
  return `${apiUrl}/api/strava/oauth/start?user_id=${enc(userId)}`;
}

export function canConnectStravaNow(status: StravaStatus | null, nowIso?: string): boolean {
  if (!status) return true;
  if (status.connected) return false;

  if (typeof status.can_connect === "boolean") return status.can_connect;

  const ra = status.reconnect_after;
  if (!ra) return true;

  const now = nowIso ?? new Date().toISOString();
  return ra <= now;
}