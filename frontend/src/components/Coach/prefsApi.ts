import { API_URL } from "@/lib/config";
import type { CoachPrefs } from "./prefsTypes";

export async function loadPrefs(userId: number): Promise<CoachPrefs | null> {
  const res = await fetch(`${API_URL}/coach/prefs/${userId}`, { cache: "no-store" });
  if (!res.ok) return null;
  const json = await res.json();
  return (json?.prefs ?? null) as CoachPrefs | null;
}

export async function savePrefs(userId: number, prefs: CoachPrefs) {
  const res = await fetch(`${API_URL}/coach/prefs/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prefs),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j?.detail || `Save failed (${res.status})`);
  }
  return true;
}