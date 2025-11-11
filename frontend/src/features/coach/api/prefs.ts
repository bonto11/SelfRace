// src/features/coach/api/prefs.ts
import { API_URL } from "@/shared/config";
import type { CoachPrefs } from "@/features/coach/types/prefsTypes";

const KEY = "coach.prefs";

/** Normalizácia rôznych BE odpovedí na samotnú hodnotu prefs */
function extractValue(j: any): CoachPrefs | null {
  // možné tvary:
  // { success: true, value: {...} }
  // { success: true, pref: { key:"coach.prefs", value:{...} } }
  // { success: true, prefs: {...} }         // coach endpoint
  // { success: true, pref: {...} }          // coach endpoint iný tvar
  return (
    j?.value ??
    j?.pref?.value ??
    j?.prefs ??
    j?.pref ??
    null
  ) as CoachPrefs | null;
}

/** GET prefs – preferuj generickú cestu, potom fallback coach */
export async function getPrefs(userId: number): Promise<CoachPrefs | null> {
  // 1) GENERIC: /users/:id/prefs/:key
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
    /* fallthrough */
  }

  return null;
}

/** SAVE prefs – preferuj generickú cestu, potom fallback coach */
export async function savePrefs(userId: number, prefs: CoachPrefs): Promise<void> {
  // 1) GENERIC: /users/:id/prefs/:key  body: { value: CoachPrefs }
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

    // pokús sa prečítať detail chyby
    const j = await r.json().catch(() => ({}));
    if (j?.detail) throw new Error(j.detail);
  } catch {
    // fall through to fallback
  }
}