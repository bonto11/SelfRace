// src/features/coach/api/thresholds.ts
// src/features/coach/api/thresholds.ts
import { API_URL } from "@/shared/config";

export type UserThresholds = {
  sport: string | null;
  threshold_type: string | null;
  updated_at: string | null;
  hr_bpm: number | null;
  pace_sec_km: number | null;
  power_watt: number | null;
  value: number | null;
  measurement_type: string | null;
};

export async function fetchUserThresholds(
  userId: number
): Promise<UserThresholds | null> {
  const url = `${API_URL}/users/${userId}/thresholds`;

  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[fetchUserThresholds] HTTP error", res.status, url);
      return null;
    }

    const json = await res.json().catch(() => null);
    if (!json || json.success !== true) return null;

    return (json.thresholds ?? null) as UserThresholds | null;
  } catch (err) {
    console.error("[fetchUserThresholds] fetch failed", err);
    return null;
  }
}

/**
 * Ukladá prahové hodnoty (napr. LT2) pre daného usera.
 * Backend si neskôr zosúladíme – očakáva sa PUT /users/{id}/thresholds.
 */
export async function saveUserThresholds(
  userId: number,
  thresholds: Partial<UserThresholds>
): Promise<void> {
  const url = `${API_URL}/users/${userId}/thresholds`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ thresholds }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(
      `[saveUserThresholds] HTTP ${res.status} ${res.statusText} ${txt}`
    );
  }
}