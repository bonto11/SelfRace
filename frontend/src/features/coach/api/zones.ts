// src/features/coach/api/zones.ts
import { API_URL } from "@/shared/config";
import type { ZoneSport, ZonesOut } from "@/features/coach/types/zonesTypes";

type ApiOkZones = { success: true; zones: ZonesOut | null };
type ApiOkMap = { success: true; zones_by_sport: Record<string, ZonesOut> };
type ApiFail = { success: false; detail?: string };

/** Načíta posledné zóny pre usera (voliteľne filtrovane podľa sport). */
export async function apiFetchUserZonesLatest(
  userId: number,
  sport?: ZoneSport
): Promise<ZonesOut | null> {
  const params = new URLSearchParams();
  if (sport) params.set("sport", sport);

  const url = `${API_URL}/users/${userId}/zones${
    params.size ? `?${params.toString()}` : ""
  }`;

  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json().catch(() => null)) as
    | ApiOkZones
    | ApiFail
    | null;

  if (!res.ok || !json || json.success === false) return null;
  return (json as ApiOkZones).zones ?? null;
}

/** Načíta posledné zóny pre všetky športy → mapované podľa sport. */
export async function apiFetchAllLatestZonesBySport(
  userId: number
): Promise<Record<ZoneSport, ZonesOut>> {
  const url = `${API_URL}/users/${userId}/zones?all=1`;

  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json().catch(() => null)) as
    | ApiOkMap
    | ApiFail
    | null;

  if (!res.ok || !json || json.success === false) {
    return {} as Record<ZoneSport, ZonesOut>;
  }

  const map = (json as ApiOkMap).zones_by_sport || {};
  return map as Record<ZoneSport, ZonesOut>;
}

/** Telo pre save – partial, sport môžeš doplniť. */
export type SaveUserZonesBody = Partial<ZonesOut> & { sport?: ZoneSport };

/** Uloží (upsertne) zóny pre daný šport a vráti ich späť. */
export async function apiSaveUserZones(
  userId: number,
  body: SaveUserZonesBody
): Promise<ZonesOut> {
  const url = `${API_URL}/users/${userId}/zones`;

  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => null)) as
    | ApiOkZones
    | ApiFail
    | null;

  if (!res.ok || !json || json.success === false) {
    const msg = (json as ApiFail)?.detail || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return (json as ApiOkZones).zones as ZonesOut;
}