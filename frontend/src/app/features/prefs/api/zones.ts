// src/features/prefs/api/zones.ts
import { callBackend } from "@/app/shared/utils/callBackend";
import type { ZoneSport, ZonesOut } from "@/app/features/coach/types/zonesTypes";

type ApiOkZones = { success: true; zones: ZonesOut | null };
type ApiOkMap = { success: true; zones_by_sport: Record<string, ZonesOut> };
type ApiFail = { success: false; detail?: string };

/** Načíta posledné zóny pre usera (voliteľne filtrované podľa sport). */
export async function apiFetchUserZonesLatest(
  userId: number,
  sport?: ZoneSport
): Promise<ZonesOut | null> {
  if (!userId) return null;

  const params = new URLSearchParams();
  if (sport) params.set("sport", sport);

  const path = `/users/${encodeURIComponent(String(userId))}/zones${
    params.size ? `?${params.toString()}` : ""
  }`;

  console.debug("[zones][GET latest] ->", path);

  try {
    const json = (await callBackend<ApiOkZones | ApiFail>(path, {
      method: "GET",
      cache: "no-store",
    })) as ApiOkZones | ApiFail | null;

    if (!json || (json as ApiFail).success === false) return null;
    return (json as ApiOkZones).zones ?? null;
  } catch (e) {
    console.error("[zones][GET latest] error", e);
    return null;
  }
}

/** Načíta posledné zóny pre všetky športy → mapované podľa sport. */
export async function apiFetchAllLatestZonesBySport(
  userId: number
): Promise<Record<ZoneSport, ZonesOut>> {
  if (!userId) return {} as Record<ZoneSport, ZonesOut>;

  const path = `/users/${encodeURIComponent(String(userId))}/zones?all=1`;

  console.debug("[zones][GET all-by-sport] ->", path);

  try {
    const json = (await callBackend<ApiOkMap | ApiFail>(path, {
      method: "GET",
      cache: "no-store",
    })) as ApiOkMap | ApiFail | null;

    if (!json || (json as ApiFail).success === false) {
      return {} as Record<ZoneSport, ZonesOut>;
    }

    const map = (json as ApiOkMap).zones_by_sport || {};
    return map as Record<ZoneSport, ZonesOut>;
  } catch (e) {
    console.error("[zones][GET all-by-sport] error", e);
    return {} as Record<ZoneSport, ZonesOut>;
  }
}

/** Telo pre save – partial, sport môžeš doplniť. */
export type SaveUserZonesBody = Partial<ZonesOut> & { sport?: ZoneSport };

/** Uloží (upsertne) zóny pre daný šport a vráti ich späť. */
export async function apiSaveUserZones(
  userId: number,
  body: SaveUserZonesBody
): Promise<ZonesOut> {
  if (!userId) {
    throw new Error("api.common.missingUserAuth");
  }

  const path = `/users/${encodeURIComponent(String(userId))}/zones`;

  console.debug("[zones][PUT] ->", path, "body", body);

  try {
    const json = (await callBackend<ApiOkZones | ApiFail>(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(body),
    })) as ApiOkZones | ApiFail | null;

    if (!json || (json as ApiFail)?.success === false) {
      throw new Error("api.prefs.zonesSaveFailed");
    }

    return (json as ApiOkZones).zones as ZonesOut;
  } catch (e) {
    console.error("[zones][PUT] error", e);
    throw new Error("api.prefs.zonesSaveFailed");
  }
}