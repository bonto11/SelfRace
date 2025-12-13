import { API_URL } from "@/shared/config";
import type { MiniActivity, SportFE } from "@/shared/types/activities";

export async function apiFetchActivitiesAround(
  userId: number,
  opts: {
    date: string;             // "YYYY-MM-DD"
    deltaDays?: number;       // default 1  ->  +/- 1 deň
    sports?: SportFE[];       // default ["run","mixed"]
  }
): Promise<MiniActivity[]> {
  const delta = opts.deltaDays ?? 1;
  const sports = (opts.sports ?? ["run","mixed"]).join(",");
  const url = `${API_URL}/activities/select/${userId}` +
              `?date=${encodeURIComponent(opts.date)}&delta_days=${delta}&sports=${encodeURIComponent(sports)}`;

  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`fetchActivitiesAround failed: ${r.status}`);
  const j = await r.json().catch(() => ({}));
  return (j?.items ?? []) as MiniActivity[];
}