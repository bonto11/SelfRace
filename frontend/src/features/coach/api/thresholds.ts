// src/features/coach/api/thresholds.ts
import { API_URL } from "@/shared/config";

/** DB row (normalized) */
export type UserThresholdRow = {
  sport: string | null;
  threshold_type: string | null;
  updated_at: string | null;
  hr_bpm: number | null;
  pace_sec_km: number | null;
  power_watt: number | null;
  measurement_type: string | null;
};

type ApiRows = { success: true; rows: UserThresholdRow[] };
type ApiRow = { success: true; thresholds: UserThresholdRow | null };
type ApiFail = { success: false; detail?: string };

/** ONE latest by sport+type (defaults running/LT2) */
export async function fetchUserThreshold(
  userId: number,
  sport = "running",
  type = "LT2"
): Promise<UserThresholdRow | null> {
  const u = `${API_URL}/users/${userId}/thresholds?sport=${encodeURIComponent(
    sport
  )}&type=${encodeURIComponent(type)}`;
  const res = await fetch(u, { cache: "no-store" });
  const json = (await res.json().catch(() => null)) as ApiRow | ApiFail | null;
  if (!res.ok || !json || (json as ApiFail).success === false) return null;
  return (json as ApiRow).thresholds ?? null;
}

/** ALL (desc updated_at) */
export async function fetchUserThresholdsAll(
  userId: number
): Promise<UserThresholdRow[]> {
  const res = await fetch(`${API_URL}/users/${userId}/thresholds/all`, {
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as ApiRows | ApiFail | null;
  if (!res.ok || !json || (json as ApiFail).success === false) return [];
  return (json as ApiRows).rows ?? [];
}

/** LATEST per (sport,type) */
export async function fetchUserThresholdsLatest(
  userId: number
): Promise<UserThresholdRow[]> {
  const res = await fetch(`${API_URL}/users/${userId}/thresholds/latest`, {
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as ApiRows | ApiFail | null;
  if (!res.ok || !json || (json as ApiFail).success === false) return [];
  return (json as ApiRows).rows ?? [];
}

/** UPSERT by (user_id,sport,threshold_type) -> returns latest row for combo */
export async function saveUserThresholds(
  userId: number,
  t: Partial<UserThresholdRow>
): Promise<UserThresholdRow | null> {
  const res = await fetch(`${API_URL}/users/${userId}/thresholds`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      sport: t.sport ?? "running",
      threshold_type: t.threshold_type ?? "LT2",
      hr_bpm: t.hr_bpm ?? null,
      pace_sec_km: t.pace_sec_km ?? null,
      power_watt: t.power_watt ?? null,
      measurement_type: t.measurement_type ?? "manual",
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.detail || `HTTP ${res.status}`);
  return (json?.thresholds ?? null) as UserThresholdRow | null;
}

/** helpers */
export function reduceLatestByCombo(rows: UserThresholdRow[]): UserThresholdRow[] {
  const map = new Map<string, UserThresholdRow>();
  for (const r of rows ?? []) {
    const key = `${(r.sport ?? "running").toLowerCase()}|${(r.threshold_type ?? "LT2").toUpperCase()}`;
    const prev = map.get(key);
    if (!prev) { map.set(key, r); continue; }
    const a = Date.parse(prev.updated_at ?? "") || 0;
    const b = Date.parse(r.updated_at ?? "") || 0;
    if (b >= a) map.set(key, r);
  }
  return Array.from(map.values());
}

export function debugLogLatestThresholds(rows: UserThresholdRow[]) {
  const out = rows.map(r => ({
    sport: r.sport, type: r.threshold_type,
    HR: r.hr_bpm, pace: r.pace_sec_km, power: r.power_watt, at: r.updated_at
  }));
  console.debug("[thresholds.latest]", out);
}