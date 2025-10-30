import { API_URL } from "@/shared/config";
import type { MiniActivity } from "@/shared/types/activities";

export async function fetchActivitiesWindow(
  userId: number,
  opts: { from: string; to: string; sports?: string[] } // sports napr. ["run","mixed"]
): Promise<MiniActivity[]> {
  const qs = new URLSearchParams({
    from: opts.from,
    to: opts.to,
    ...(opts.sports?.length ? { sports: opts.sports.join(",") } : {}),
  });
  const r = await fetch(`${API_URL}/activities/window/${userId}?${qs.toString()}`, {
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`activities fetch failed: ${r.status}`);
  const j = await r.json().catch(() => ([]));
  return Array.isArray(j) ? j : (j?.items ?? []);
}