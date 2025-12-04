// src/features/coach/api/prefs.ts
import { API_URL } from "@/shared/config";

// kľúč pre coach prefs
const KEY = "coach.prefs";

/**
 * Normalizuje rôzne možné tvary odpovedí z BE
 * na čistú hodnotu CoachPrefs.
 *
 * Podporované:
 *  - { value: ... }
 *  - { pref: { value: ... } }
 *  - { prefs: ... }
 *  - { pref: ... }
 */


function extractValue(j: unknown): any | null {
  const any = j as any;
  return (
    any?.value ??    // {"success": true, "key": "...", "value": {...}}
    any?.pref2?.value ??
    any?.prefs ??
    any?.pref ??
    null
  );
}

/** GET prefs – /users/{id}/prefs/coach.prefs */
export async function apiGetCoachPrefs(
  userId: number
): Promise<any | null> {
  try {
    const url = `${API_URL}/users/${userId}/prefs/${encodeURIComponent(KEY)}`;
    const r = await fetch(url, { cache: "no-store" });
    if (r.ok) {
      const j = await r.json().catch(() => ({}));
      const val = extractValue(j);
      console.log("[apiGetCoachPrefs] raw:", j, "val:", val);
      if (val) return val;
    }
  } catch {
    /* ignore – caller dorieši defaulty */
  }
  return null;
}

/** SAVE prefs – /users/{id}/prefs/coach.prefs */
export async function apiSaveCoachPrefs(
  userId: number,
  prefs: any
): Promise<void> {
  const url = `${API_URL}/users/${userId}/prefs/${encodeURIComponent(KEY)}`;
  const r = await fetch(url, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ value: prefs }),
  });
  if (!r.ok) {
    throw new Error(`Saving coach.prefs failed: ${r.status}`);
  }
}