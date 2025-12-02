// src/features/coach/api/prefs.ts
import { API_URL } from "@/shared/config";
import type { CoachPrefs } from "@/features/coach/types/prefsTypes";

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
function extractValue(j: unknown): CoachPrefs | null {
  const any = j as any;
  return (
    any?.value ??
    any?.pref?.value ??
    any?.prefs ??
    any?.pref ??
    null
  ) as CoachPrefs | null;
}

/** GET prefs – generická cesta: /users/{id}/prefs/coach.prefs */
export async function apiGetPrefs(userId: number): Promise<CoachPrefs | null> {
  try {
    const url = `${API_URL}/users/${userId}/prefs/${encodeURIComponent(KEY)}`;
    const r = await fetch(url, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      const val = extractValue(j);
      if (val) return val;
    }
  } catch {
    /* ignore – caller si vie spraviť fallback na localStorage */
  }
  return null;
}

/** SAVE prefs – generická cesta: /users/{id}/prefs/coach.prefs */
export async function apiSavePrefs(
  userId: number,
  prefs: CoachPrefs
): Promise<void> {
  try {
    const url = `${API_URL}/users/${userId}/prefs/${encodeURIComponent(KEY)}`;
    const r = await fetch(url, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ value: prefs }),
    });

    if (r.ok) return;

    // skús detail chyby
    const j = await r.json().catch(() => ({}));
    if (j?.detail) throw new Error(j.detail);
  } catch {
    // swallow – nech caller rieši UI notifikáciu
  }
}