// src/features/prefs/api/thresholds.ts
import { callBackend } from "@/app/shared/utils/callBackend";
import type { UserThresholdRow } from "@/app/features/coach/types/thresholdsTypes";

type ApiRows = { success: true; rows: UserThresholdRow[] };
type ApiRow = { success: true; thresholds: UserThresholdRow | null };
type ApiFail = { success: false; detail?: string };

/** ONE latest by (sport, type) – default: running / LT2. */
export async function apiFetchUserThreshold(
  userId: number,
  sport = "running",
  type = "LT2"
): Promise<UserThresholdRow | null> {
  if (!userId) return null;

  const path = `/users/${encodeURIComponent(
    String(userId)
  )}/thresholds?sport=${encodeURIComponent(sport)}&type=${encodeURIComponent(
    type
  )}`;

  console.debug("[thresholds][GET one] ->", path);

  try {
    const json = (await callBackend<ApiRow | ApiFail>(path, {
      method: "GET",
      cache: "no-store",
    })) as ApiRow | ApiFail | null;

    if (!json || (json as ApiFail).success === false) return null;
    return (json as ApiRow).thresholds ?? null;
  } catch (e) {
    console.error("[thresholds][GET one] error", e);
    return null; // Tichý fail, formulár sa s tým vysporiada
  }
}

/** ALL (desc updated_at) – na debug / históriu. */
export async function apiFetchUserThresholdsAll(
  userId: number
): Promise<UserThresholdRow[]> {
  if (!userId) return [];

  const path = `/users/${encodeURIComponent(
    String(userId)
  )}/thresholds/all`;

  console.debug("[thresholds][GET all] ->", path);

  try {
    const json = (await callBackend<ApiRows | ApiFail>(path, {
      method: "GET",
      cache: "no-store",
    })) as ApiRows | ApiFail | null;

    if (!json || (json as ApiFail).success === false) return [];
    return (json as ApiRows).rows ?? [];
  } catch (e) {
    console.error("[thresholds][GET all] error", e);
    return [];
  }
}

/** LATEST per (sport,type). */
export async function apiFetchUserThresholdsLatest(
  userId: number
): Promise<UserThresholdRow[]> {
  if (!userId) return [];

  const path = `/users/${encodeURIComponent(
    String(userId)
  )}/thresholds/latest`;

  console.debug("[thresholds][GET latest] ->", path);

  try {
    const json = (await callBackend<ApiRows | ApiFail>(path, {
      method: "GET",
      cache: "no-store",
    })) as ApiRows | ApiFail | null;

    if (!json || (json as ApiFail).success === false) return [];
    return (json as ApiRows).rows ?? [];
  } catch (e) {
    console.error("[thresholds][GET latest] error", e);
    return [];
  }
}

/**
 * UPSERT by (user_id,sport,threshold_type) -> returns latest row for combo.
 */
export async function apiSaveUserThresholds(
  userId: number,
  t: Partial<UserThresholdRow>
): Promise<UserThresholdRow | null> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/users/${encodeURIComponent(String(userId))}/thresholds`;

  const body = {
    sport: t.sport ?? "running",
    threshold_type: t.threshold_type ?? "LT2",
    hr_bpm: t.hr_bpm ?? null,
    pace_sec_km: t.pace_sec_km ?? null,
    power_watt: t.power_watt ?? null,
    measurement_type: t.measurement_type ?? "manual",
  };

  console.debug("[thresholds][PUT] ->", path, "body", body);

  try {
    const json = (await callBackend<ApiRow | ApiFail>(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(body),
    })) as ApiRow | ApiFail | null;

    if (!json || (json as ApiFail).success === false) {
      throw new Error("api.prefs.thresholdsSaveFailed");
    }

    return (json as ApiRow).thresholds ?? null;
  } catch (e) {
    console.error("[thresholds][PUT] error", e);
    throw new Error("api.prefs.thresholdsSaveFailed");
  }
}