import { API_URL } from "@/shared/config";
import type { CoachPrefs } from "@/features/coach/types/prefsTypes";

const KEY = "coach.prefs";

/** Normalizácia rôznych BE odpovedí na samotnú hodnotu prefs */
function extractValue(j: any): CoachPrefs | null {
  return (
    j?.value ??
    j?.pref?.value ??
    j?.prefs ??
    j?.pref ??
    null
  ) as CoachPrefs | null;
}

/** GET prefs – generická cesta */
export async function apiGetPrefs(userId: number): Promise<CoachPrefs | null> {
  try {
    const r = await fetch(
      `${API_URL}/users/${userId}/prefs/${encodeURIComponent(KEY)}`,
      { cache: "no-store" }
    );
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      const val = extractValue(j);
      if (val) return val;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** SAVE prefs – generická cesta */
export async function apiSavePrefs(userId: number, prefs: CoachPrefs): Promise<void> {
  try {
    const r = await fetch(
      `${API_URL}/users/${userId}/prefs/${encodeURIComponent(KEY)}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ value: prefs }),
      }
    );
    if (r.ok) return;

    // skús detail chyby
    const j = await r.json().catch(() => ({}));
    if (j?.detail) throw new Error(j.detail);
  } catch {
    // swallow – nech caller rieši UI notifikáciu
  }
}