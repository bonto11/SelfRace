import { API_URL } from "@/lib/config";

export type Best = { distance_km: number; time_str: string; event_name?: string; date?: string };

export async function loadBests(userId: number): Promise<Best[]> {
  const r = await fetch(`${API_URL}/coach/bests/${userId}`, { cache: "no-store" });
  if (!r.ok) return [];
  const j = await r.json();
  return j?.bests ?? [];
}

export async function saveBest(userId: number, best: Best) {
  const r = await fetch(`${API_URL}/coach/bests/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(best),
  });
  if (!r.ok) {
    const j = await r.json().catch(()=> ({}));
    throw new Error(j?.detail || `Save failed (${r.status})`);
  }
}