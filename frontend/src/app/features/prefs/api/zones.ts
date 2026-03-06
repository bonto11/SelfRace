// src/features/prefs/api/zones.ts
import { callBackend } from "@/app/shared/utils/callBackend";
import type { ZoneSport, ZonesOut } from "@/app/features/coach/types/zonesTypes";

type ApiOkZones = { success: true; zones: ZonesOut | null };
type ApiOkMap = { success: true; zones_by_sport: Record<string, ZonesOut> };
type ApiOkZoneTrends = { success: true; trends: ZonesOut[] };
type ApiFail = { success: false; detail?: string };

export async function apiFetchUserZonesLatest(
  userId: number,
  sport?: ZoneSport
): Promise<ZonesOut | null> {
  if (!userId) return null;
  const params = new URLSearchParams();
  if (sport) params.set("sport", sport);

  const path = `/users/${encodeURIComponent(String(userId))}/zones${params.size ? `?${params.toString()}` : ""}`;

  try {
    const json = await callBackend<ApiOkZones | ApiFail>(path, { method: "GET", cache: "no-store" });
    if (!json || (json as ApiFail).success === false) return null;
    return (json as ApiOkZones).zones ?? null;
  } catch (e) {
    console.error("[zones][GET latest] error", e);
    return null;
  }
}

export async function apiFetchAllLatestZonesBySport(
  userId: number
): Promise<Record<ZoneSport, ZonesOut>> {
  if (!userId) return {} as Record<ZoneSport, ZonesOut>;
  const path = `/users/${encodeURIComponent(String(userId))}/zones?all=1`;

  try {
    const json = await callBackend<ApiOkMap | ApiFail>(path, { method: "GET", cache: "no-store" });
    if (!json || (json as ApiFail).success === false) return {} as Record<ZoneSport, ZonesOut>;
    return (json as ApiOkMap).zones_by_sport || {} as Record<ZoneSport, ZonesOut>;
  } catch (e) {
    console.error("[zones][GET all-by-sport] error", e);
    return {} as Record<ZoneSport, ZonesOut>;
  }
}

/** NOVÉ: Načíta historické dáta pre vykreslenie trendu LTHR/Zón */
export async function apiFetchUserZoneTrends(
  userId: number,
  sport: ZoneSport = "running", // 🔥 OPRAVA TU: Zmenené z "run" na "running"
  days: number = 90
): Promise<ZonesOut[]> {
  if (!userId) return [];
  const params = new URLSearchParams({ sport, days: String(days) });
  const path = `/users/${encodeURIComponent(String(userId))}/zones/trends?${params.toString()}`;

  try {
    const json = await callBackend<ApiOkZoneTrends | ApiFail>(path, { method: "GET", cache: "no-store" });
    if (!json || (json as ApiFail).success === false) return [];
    return (json as ApiOkZoneTrends).trends || [];
  } catch (e) {
    console.error("[zones][GET trends] error", e);
    return [];
  }
}

export type SaveUserZonesBody = Partial<ZonesOut> & { sport?: ZoneSport };

export async function apiSaveUserZones(
  userId: number,
  body: SaveUserZonesBody
): Promise<ZonesOut> {
  if (!userId) throw new Error("api.common.missingUserAuth");
  const path = `/users/${encodeURIComponent(String(userId))}/zones`;

  try {
    const json = await callBackend<ApiOkZones | ApiFail>(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(body),
    });

    if (!json || (json as ApiFail)?.success === false) throw new Error("api.prefs.zonesSaveFailed");
    return (json as ApiOkZones).zones as ZonesOut;
  } catch (e) {
    console.error("[zones][PUT] error", e);
    throw new Error("api.prefs.zonesSaveFailed");
  }
}
