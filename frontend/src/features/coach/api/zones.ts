// src/features/coach/api/zones.ts
import { API_URL } from "@/shared/config";

export type UserZones = {
  z1_min: number;
  z1_max: number;
  z2_min: number;
  z2_max: number;
  z3_min: number;
  z3_max: number;
  z4_min: number;
  z4_max: number;
  z5_min: number;
  z5_max: number;
  hr_max?: number | null; // pridaj, ak ho používaš
};

export async function fetchUserZones(
  userId: number
): Promise<UserZones | null> {
  const url = `${API_URL}/users/${userId}/zones`;

  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[fetchUserZones] HTTP error", res.status, url);
      return null;
    }

    const json = await res.json().catch(() => null);
    if (!json || json.success !== true) return null;

    return (json.zones ?? null) as UserZones | null;
  } catch (err) {
    console.error("[fetchUserZones] fetch failed", err);
    return null;
  }
}

/**
 * Ukladá zóny pre daného usera.
 */
export async function saveUserZones(
  userId: number,
  zones: Partial<UserZones> & { hr_max?: number | null }
): Promise<void> {
  const url = `${API_URL}/users/${userId}/zones`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    // DÔLEŽITÉ: posielame priamo zones, nie { zones: ... }
    body: JSON.stringify(zones),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(
      `[saveUserZones] HTTP ${res.status} ${res.statusText} ${txt}`
    );
  }
}