// src/features/coach/api/thresholds.ts
import { API_URL } from "@/shared/config";

export type UserThresholdRow = {
  sport: string | null;
  threshold_type: string | null;
  updated_at: string | null;
  hr_bpm: number | null;       // FE snake_case pre konzistenciu s BE
  pace_sec_km: number | null;
  power_watt: number | null;
  value?: number | null;
  measurement_type: string | null;
};

type ApiOk<T> = { success: true; thresholds: T };
type ApiFail = { success: false; detail?: string };

// GET — zatiaľ 1 najnovší záznam podľa BE (running/LT2 default)
export async function fetchUserThresholds(
  userId: number
): Promise<UserThresholdRow | null> {
  const url = `${API_URL}/users/${userId}/thresholds`;
  const res = await fetch(url, { method: "GET", cache: "no-store" });
  const json = (await res.json().catch(() => null)) as ApiOk<UserThresholdRow> | ApiFail | null;
  if (!res.ok || !json || (json as ApiFail).success === false) return null;
  return (json as ApiOk<UserThresholdRow>).thresholds ?? null;
}

// PUT — vráti uložený záznam (už normalizovaný BE)
export async function saveUserThresholds(
  userId: number,
  thresholds: Partial<UserThresholdRow>
): Promise<UserThresholdRow> {
  const url = `${API_URL}/users/${userId}/thresholds`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ ...thresholds }),
  });
  const json = (await res.json().catch(() => null)) as ApiOk<UserThresholdRow> | ApiFail | null;
  if (!res.ok || !json || (json as ApiFail).success === false) {
    const msg = (json as ApiFail)?.detail || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return (json as ApiOk<UserThresholdRow>).thresholds;
}

/** Všetky riadky (zoradené desc na BE) */
export async function fetchUserThresholdsAll(userId: number): Promise<UserThresholdRow[]> {
  const url = `${API_URL}/users/${userId}/thresholds/all`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const json = await res.json().catch(() => null);
  return json?.success ? (json.rows as UserThresholdRow[]) : [];
}

/** Najnovší pre každú kombináciu (ak chceš priamo BE z /latest) */
export async function fetchUserThresholdsLatest(userId: number): Promise<UserThresholdRow[]> {
  const url = `${API_URL}/users/${userId}/thresholds/latest`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const json = await res.json().catch(() => null);
  return json?.success ? (json.rows as UserThresholdRow[]) : [];
}

/** Redukcia na FE: najnovší pre (sport × type) z ľubovoľného zoznamu */
export function reduceLatestByCombo(rows: UserThresholdRow[]): UserThresholdRow[] {
  const out: UserThresholdRow[] = [];
  const seen = new Set<string>();
  for (const r of [...rows].sort((a, b) => Date.parse(b.updated_at ?? "") - Date.parse(a.updated_at ?? ""))) {
    const key = `${r.sport ?? ""}:${r.threshold_type ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/** Debug helper – vytlačí peknú tabuľku */
export function debugLogLatestThresholds(rows: UserThresholdRow[]) {
  const latest = reduceLatestByCombo(rows);
  const mmss = (s: number | null) => {
    if (!s || s <= 0) return "";
    const m = Math.floor(s / 60);
    const ss = String(Math.round(s % 60)).padStart(2, "0");
    return `${m}:${ss}`;
  };
  const table = latest.map((r) => ({
    sport: r.sport,
    type: r.threshold_type,
    updated: r.updated_at,
    HR: r.hr_bpm ?? "",
    Pace: mmss(r.pace_sec_km ?? null),
    Power: r.power_watt ?? "",
    source: r.measurement_type ?? "",
  }));
  // výpis len do konzoly:
  // eslint-disable-next-line no-console
  console.table(table);
}