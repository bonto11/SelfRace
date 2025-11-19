import { API_URL } from "@/shared/config";

/** DB row */
export type UserThresholdRow = {
  sport: string | null;
  threshold_type: string | null;
  updated_at: string | null;
  hr_bpm: number | null;
  pace_sec_km: number | null;
  power_watt: number | null;
  measurement_type: string | null;
};

/** GET latest rows (BE môže vrátiť jeden objekt alebo pole) */
export async function fetchUserThresholdsLatest(userId: number): Promise<UserThresholdRow[]> {
  const url = `${API_URL}/users/${userId}/thresholds`;
  try {
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return [];
    const raw = json?.thresholds ?? json ?? null;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw as UserThresholdRow[];
    return [raw as UserThresholdRow];
  } catch {
    return [];
  }
}

/** Reduce na latest per (sport, type) podľa updated_at */
export function reduceLatestByCombo(rows: UserThresholdRow[]): UserThresholdRow[] {
  const map = new Map<string, UserThresholdRow>();
  for (const r of rows ?? []) {
    const key = `${r.sport ?? "running"}|${r.threshold_type ?? "LT2"}`;
    const prev = map.get(key);
    if (!prev) { map.set(key, r); continue; }
    const a = Date.parse(prev.updated_at ?? "") || 0;
    const b = Date.parse(r.updated_at ?? "") || 0;
    if (b >= a) map.set(key, r);
  }
  return Array.from(map.values());
}

export function debugLogLatestThresholds(rows: UserThresholdRow[]) {
  // krátky, čitateľný log
  const out = rows.map(r => ({
    sport: r.sport, type: r.threshold_type,
    HR: r.hr_bpm, pace: r.pace_sec_km, power: r.power_watt, at: r.updated_at
  }));
  // eslint-disable-next-line no-console
  console.debug("[thresholds.latest]", out);
}

/** PUT (upsert) threshold pre danú kombináciu */
export async function saveUserThresholds(userId: number, t: Partial<UserThresholdRow>): Promise<UserThresholdRow | null> {
  const url = `${API_URL}/users/${userId}/thresholds`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      sport: t.sport ?? "running",
      threshold_type: t.threshold_type ?? "LT2",
      hr_bpm: t.hr_bpm ?? t.hr_bpm ?? null,
      pace_sec_km: t.pace_sec_km ?? null,
      power_watt: t.power_watt ?? null,
      measurement_type: t.measurement_type ?? "manual",
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.detail || `HTTP ${res.status}`);
  return (json?.thresholds ?? null) as UserThresholdRow | null;
}