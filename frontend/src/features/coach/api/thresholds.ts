// src/features/coach/api/thresholds.ts
// src/features/coach/api/thresholds.ts
import { API_URL } from "@/shared/config";
import type { UserThresholdRow } from "@/features/coach/types/thresholdsTypes";

type ApiRows = { success: true; rows: UserThresholdRow[] };
type ApiRow = { success: true; thresholds: UserThresholdRow | null };
type ApiFail = { success: false; detail?: string };

/** ONE latest by (sport, type) – default: running / LT2. */
export async function apiFetchUserThreshold(
  userId: number,
  sport = "running",
  type = "LT2"
): Promise<UserThresholdRow | null> {
  const url = `${API_URL}/users/${userId}/thresholds?sport=${encodeURIComponent(
    sport
  )}&type=${encodeURIComponent(type)}`;

  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json().catch(() => null)) as ApiRow | ApiFail | null;

  if (!res.ok || !json || json.success === false) return null;
  return (json as ApiRow).thresholds ?? null;
}

/** ALL (desc updated_at) – na debug / históriu. */
export async function apiFetchUserThresholdsAll(
  userId: number
): Promise<UserThresholdRow[]> {
  const url = `${API_URL}/users/${userId}/thresholds/all`;

  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json().catch(() => null)) as
    | ApiRows
    | ApiFail
    | null;

  if (!res.ok || !json || json.success === false) return [];
  return (json as ApiRows).rows ?? [];
}

/** LATEST per (sport,type). */
export async function apiFetchUserThresholdsLatest(
  userId: number
): Promise<UserThresholdRow[]> {
  const url = `${API_URL}/users/${userId}/thresholds/latest`;

  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json().catch(() => null)) as
    | ApiRows
    | ApiFail
    | null;

  if (!res.ok || !json || json.success === false) return [];
  return (json as ApiRows).rows ?? [];
}

/**
 * UPSERT by (user_id,sport,threshold_type) -> returns latest row for combo.
 */
export async function apiSaveUserThresholds(
  userId: number,
  t: Partial<UserThresholdRow>
): Promise<UserThresholdRow | null> {
  const url = `${API_URL}/users/${userId}/thresholds`;

  const res = await fetch(url, {
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

  const json = await res.json().catch(() => ({} as ApiRow | ApiFail));

  if (!res.ok) {
    const msg = (json as ApiFail)?.detail || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return (json as ApiRow).thresholds ?? null;
}