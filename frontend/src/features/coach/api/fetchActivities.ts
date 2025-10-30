import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import type { MiniActivity } from "@/features/coach/types/pbview";

// pomocník na ±days
function addDays(iso: string, delta: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

export default async function fetchActivitiesAround(
  userId: number,
  dateIso: string
): Promise<MiniActivity[]> {
  // Dočasná BE trasa – uprav podľa tvojho BE
  const from = addDays(dateIso, -1);
  const to = addDays(dateIso, +1);
  const url = `${API_URL}/activities/window/${userId}?from=${from}&to=${to}&sports=run,mixed`;

  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`activities fetch failed: ${r.status}`);
  const j = await r.json().catch(() => ([]));
  // Očakávame pole { id, name, start_date, sport, distance_km, duration_min }
  return Array.isArray(j) ? j : (j?.items ?? []);
}