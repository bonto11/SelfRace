// app/features/strava/api/strava.ts
import { callBackend } from "@/app/shared/utils/callBackend";

/**
 * StravaStatus – držme to dopredu kompatibilné:
 * - connected: bool
 * - athlete_id: number|null
 * - scopes: string[]
 * - expires_at: ISO string | null
 * - disconnected_at: ISO string | null  (budeme potrebovať pre 24h blok)
 * - reconnect_after: ISO string | null  (BE môže poslať rovno computed)
 * - can_connect: bool | null           (BE môže poslať hint)
 * - can_manual_import: bool | null     (BE môže poslať hint)
 * - manual_import_window_days: number | null (napr 7 po re-connecte)
 */
export type StravaStatus = {
  connected: boolean;
  athlete_id: number | null;
  scopes: string[];
  expires_at: string | null;

  // NEW (voliteľné – ak BE zatiaľ neposiela, nič sa nedeje)
  disconnected_at?: string | null;
  reconnect_after?: string | null;
  can_connect?: boolean | null;
  can_manual_import?: boolean | null;
  manual_import_window_days?: number | null;
};

export type DisconnectPayload = {
  /**
   * FE: checkbox consent (musí byť true, inak BE môže odmietnuť)
   * FE: informácia že user rozumie 24h bloku a mazaniu dát
   */
  consent: boolean;
  /**
   * Pre audit/telemetriu (voliteľné)
   */
  reason?: "user_request" | string;
};

export type DisconnectResult = {
  ok: boolean;
  disconnected_at?: string | null;
  reconnect_after?: string | null;
};

export type ImportLimits = {
  /**
   * povolené okno pre manuálny import (dni dozadu)
   * - default (first connect / bežný režim): napr 50
   * - po disconnect+reconnect: 7
   */
  manual_window_days: number;
  /**
   * kedy najskôr môže user znovu pripojiť
   */
  reconnect_after?: string | null;
};

/* =========================================================================
   Helpers
   ========================================================================= */

function enc(v: any) {
  return encodeURIComponent(String(v));
}

/**
 * Poznámka k endpointom:
 * - nechávam kompatibilné s tvojimi existujúcimi:
 *   GET  /api/strava/status?user_id=...
 *   POST /api/strava/disconnect?user_id=...
 *
 * Zároveň pripravujem “čistejší” štýl cez callBackend:
 * - path je relatívny k API base v callBackend
 * - cookies/auth rieši callBackend
 */

export async function apiGetStravaStatus(userId: number): Promise<StravaStatus> {
  if (!userId) throw new Error("Missing userId in apiGetStravaStatus");

  const path = `/strava/status?user_id=${enc(userId)}`;
  console.debug("[Strava][apiGetStravaStatus] ->", path);

  try {
    const json = await callBackend<StravaStatus & { detail?: string }>(path, {
      method: "GET",
      cache: "no-store",
    });

    // Normalizácia pre prípad starších tvarov odpovede
    return {
      connected: !!(json as any)?.connected,
      athlete_id:
        typeof (json as any)?.athlete_id === "number" ? (json as any).athlete_id : null,
      scopes: Array.isArray((json as any)?.scopes) ? (json as any).scopes : [],
      expires_at: (json as any)?.expires_at ?? null,

      disconnected_at: (json as any)?.disconnected_at ?? null,
      reconnect_after: (json as any)?.reconnect_after ?? null,
      can_connect: typeof (json as any)?.can_connect === "boolean" ? (json as any).can_connect : null,
      can_manual_import:
        typeof (json as any)?.can_manual_import === "boolean" ? (json as any).can_manual_import : null,
      manual_import_window_days:
        typeof (json as any)?.manual_import_window_days === "number"
          ? (json as any).manual_import_window_days
          : null,
    };
  } catch (e: any) {
    console.error("[Strava][apiGetStravaStatus] ERROR", e);
    const msg =
      e instanceof Error ? e.message : "Failed to load Strava status (apiGetStravaStatus)";
    throw new Error(msg);
  }
}

/**
 * Odpojenie Stravy – nový štýl:
 * - posielame JSON payload (consent: true)
 * - stále podporíme query user_id kvôli backward kompatibilite BE
 */
export async function apiDisconnectStrava(
  userId: number,
  payload: DisconnectPayload
): Promise<DisconnectResult> {
  if (!userId) throw new Error("Missing userId in apiDisconnectStrava");
  if (!payload?.consent) throw new Error("Consent is required to disconnect Strava");

  const path = `/strava/disconnect?user_id=${enc(userId)}`;
  console.debug("[Strava][apiDisconnectStrava] ->", path, "payload:", payload);

  try {
    const json = await callBackend<any>(path, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    return {
      ok: true,
      disconnected_at: json?.disconnected_at ?? null,
      reconnect_after: json?.reconnect_after ?? null,
    };
  } catch (e: any) {
    console.error("[Strava][apiDisconnectStrava] ERROR", e);
    const msg =
      e instanceof Error ? e.message : "Failed to disconnect Strava (apiDisconnectStrava)";
    throw new Error(msg);
  }
}

/**
 * (VOLITEĽNÉ) BE môže mať endpoint, ktorý vráti limity/import okno podľa stavu usera
 * – hodí sa pre FE, aby vedel vysvetliť "prečo len 7 dní".
 */
export async function apiGetStravaImportLimits(userId: number): Promise<ImportLimits | null> {
  if (!userId) return null;

  const path = `/strava/import-limits?user_id=${enc(userId)}`;
  console.debug("[Strava][apiGetStravaImportLimits] ->", path);

  try {
    const json = await callBackend<any>(path, { method: "GET", cache: "no-store" });

    const manual_window_days =
      typeof json?.manual_window_days === "number" ? json.manual_window_days : 50;

    return {
      manual_window_days,
      reconnect_after: json?.reconnect_after ?? null,
    };
  } catch (e) {
    // nech to nikdy nezabije UI – len fallback na default
    console.warn("[Strava][apiGetStravaImportLimits] WARN -> fallback", e);
    return { manual_window_days: 50, reconnect_after: null };
  }
}

/**
 * (VOLITEĽNÉ) Utility: url na connect flow (keď chceš mať v jednom mieste)
 * FE to môže použiť namiesto skladania stringu v komponente.
 */
export function getStravaConnectUrl(userId: number, apiUrl: string): string {
  // kompatibilné s existujúcim BE: /api/strava/oauth/start?user_id=...
  return `${apiUrl}/api/strava/oauth/start?user_id=${enc(userId)}`;
}

/**
 * (VOLITEĽNÉ) Helper pre “can connect now?” – používa status fields, ak ich BE posiela.
 * Ak BE nič neposiela, rozhodne podľa reconnect_after / disconnected_at (ak sú).
 */
export function canConnectStravaNow(status: StravaStatus | null, nowIso?: string): boolean {
  if (!status) return true;
  if (status.connected) return false;

  if (typeof status.can_connect === "boolean") return status.can_connect;

  const ra = status.reconnect_after;
  if (!ra) return true;

  const now = nowIso ?? new Date().toISOString();
  return ra <= now;
}