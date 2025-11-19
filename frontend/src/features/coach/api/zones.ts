// src/features/coach/api/zones.ts
import { API_URL } from "@/shared/config";

export type UserZones = {
  hr_max: number | null;
  z1_min: number | null; z1_max: number | null;
  z2_min: number | null; z2_max: number | null;
  z3_min: number | null; z3_max: number | null;
  z4_min: number | null; z4_max: number | null;
  z5_min: number | null; z5_max: number | null;
};

type ApiOk<T> = { success: true; zones: T };
type ApiFail = { success: false; detail?: string };

export async function fetchUserZones(userId: number): Promise<UserZones | null> {
  const res = await fetch(`${API_URL}/users/${userId}/zones`, { cache: "no-store" });
  const json = (await res.json().catch(() => null)) as ApiOk<UserZones> | ApiFail | null;
  if (!res.ok || !json || (json as ApiFail).success === false) return null;
  return (json as ApiOk<UserZones>).zones ?? null;
}

export async function saveUserZones(
  userId: number,
  zones: Partial<UserZones>
): Promise<UserZones> {
  const res = await fetch(`${API_URL}/users/${userId}/zones`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ zones }),
  });
  const json = (await res.json().catch(() => null)) as ApiOk<UserZones> | ApiFail | null;
  if (!res.ok || !json || (json as ApiFail).success === false) {
    const msg = (json as ApiFail)?.detail || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return (json as ApiOk<UserZones>).zones;
}