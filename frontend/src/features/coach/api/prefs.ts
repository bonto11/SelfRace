// src/features/coach/api/prefs.ts
import { API_URL } from "@/shared/config";
import type { CoachPrefs } from "@/features/coach/types/prefsTypes";

const KEY = "coach.prefs";

/**
 * Načíta prefs z BE.
 * 1) skúsi /coach/prefs/:userId  -> očakáva { success: true, prefs: CoachPrefs }
 * 2) fallback /userprefs/:userId?key=coach.prefs -> očakáva { success: true, value: CoachPrefs }
 */
export async function getPrefs(userId: number): Promise<CoachPrefs | null> {
  // pokus 1 – “nový” endpoint
  try {
    const r = await fetch(`${API_URL}/coach/prefs/${userId}`, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j?.success && j?.prefs) {
      return j.prefs as CoachPrefs;
    }
  } catch {
    /* fallthrough */
  }

  // pokus 2 – generický userprefs endpoint (ak ho ešte používaš)
  try {
    const r = await fetch(`${API_URL}/userprefs/${userId}?key=${encodeURIComponent(KEY)}`, {
      cache: "no-store",
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && (j?.value || j?.prefs)) {
      // niektoré BE vracajú {value}, iné {prefs}
      return (j.value ?? j.prefs) as CoachPrefs;
    }
  } catch {
    /* ignore */
  }

  return null;
}

/**
 * Uloží prefs do BE.
 * 1) skúsi PUT /coach/prefs/:userId  body: CoachPrefs  -> { success: true }
 * 2) fallback PUT /userprefs/:userId  body: { key, value }
 */
export async function savePrefs(userId: number, prefs: CoachPrefs): Promise<void> {
  // pokus 1 – “nový” endpoint
  try {
    const r = await fetch(`${API_URL}/coach/prefs/${userId}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(prefs),
    });
    if (r.ok) return;

    // ak BE vracia JSON s chybou, skús ju prečítať
    const j = await r.json().catch(() => ({}));
    if (j?.detail) throw new Error(j.detail);
  } catch {
    // prepadni na fallback
  }

  // pokus 2 – generický userprefs endpoint
  const r2 = await fetch(`${API_URL}/userprefs/${userId}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ key: KEY, value: prefs }),
  });

  if (!r2.ok) {
    const j = await r2.json().catch(() => ({}));
    throw new Error(j?.detail ?? `save prefs failed: ${r2.status}`);
  }
}