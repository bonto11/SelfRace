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
};

export async function fetchUserZones(userId: number): Promise<UserZones | null> {
  const res = await fetch(`${API_URL}/profile/zones/${userId}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) {
    // ak chceš byť tvrdší, hoď error; teraz len ticho fail
    return null;
  }

  const json = await res.json().catch(() => null);
  if (!json || json.success !== true) return null;

  return (json.zones ?? null) as UserZones | null;
}