// src/features/coach/api/prefs.ts
import { API_URL } from "@/shared/config";
import type { CoachPrefs } from "@/features/coach/types/prefsTypes"; // CHANGED import

export async function getPrefs(userId: number): Promise<CoachPrefs | null> {
  const r = await fetch(`${API_URL}/coach/prefs/${userId}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`prefs load failed: ${r.status}`);
  const j = await r.json().catch(() => ({}));
  // očakávame { prefs: CoachPrefs } – ak nie, vrátime null
  return (j?.prefs ?? null) as CoachPrefs | null;
}

export async function savePrefs(userId: number, prefs: CoachPrefs): Promise<void> {
  const r = await fetch(`${API_URL}/coach/prefs/${userId}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(prefs),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j?.detail ?? `save prefs failed: ${r.status}`);
  }
}