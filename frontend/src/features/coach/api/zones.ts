// src/features/coach/api/zones.ts
import { API_URL } from "@/shared/config";

export type ZoneSport = "running" | "cycling" | "other";

export type ZonesOut = {
  sport: ZoneSport;
  hr_max: number | null;
  z1_min: number | null; z1_max: number | null;
  z2_min: number | null; z2_max: number | null;
  z3_min: number | null; z3_max: number | null;
  z4_min: number | null; z4_max: number | null;
  z5_min: number | null; z5_max: number | null;
  created_at?: string | null;
};

type ApiOkZones = { success: true; zones: ZonesOut | null };
type ApiOkMap = { success: true; zones_by_sport: Record<string, ZonesOut> };
type ApiFail = { success: false; detail?: string };

export async function apiFetchUserZonesLatest(
  userId: number,
  sport?: ZoneSport
): Promise<ZonesOut | null> {
  const params = new URLSearchParams();
  if (sport) params.set("sport", sport);
  const res = await fetch(`${API_URL}/users/${userId}/zones${params.size ? `?${params}` : ""}`, { cache: "no-store" });
  const json = await res.json().catch(() => null) as ApiOkZones | ApiFail | null;
  if (!res.ok || !json || (json as ApiFail).success === false) return null;
  return (json as ApiOkZones).zones ?? null;
}

export async function apiFetchAllLatestZonesBySport(
  userId: number
): Promise<Record<ZoneSport, ZonesOut>> {
  const res = await fetch(`${API_URL}/users/${userId}/zones?all=1`, { cache: "no-store" });
  const json = await res.json().catch(() => null) as ApiOkMap | ApiFail | null;
  if (!res.ok || !json || (json as ApiFail).success === false) return {} as any;
  const map = (json as ApiOkMap).zones_by_sport || {};
  return map as Record<ZoneSport, ZonesOut>;
}

export type SaveUserZonesBody = Partial<ZonesOut> & { sport?: ZoneSport };

export async function apiSaveUserZones(
  userId: number,
  body: SaveUserZonesBody
): Promise<ZonesOut> {
  const res = await fetch(`${API_URL}/users/${userId}/zones`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null) as ApiOkZones | ApiFail | null;
  if (!res.ok || !json || (json as ApiFail).success === false) {
    const msg = (json as ApiFail)?.detail || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return (json as ApiOkZones).zones!;
}