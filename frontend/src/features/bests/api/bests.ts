// features/bests/api/bests.ts
import { API_URL } from "@/shared/config";
import { distanceOptions, sortBySportOrder, normalizeRow, isAllowedDistance } from "@/features/bests/utils/bests"
import { Sport, UserBest} from "@/features/bests/types/bests"

/** GET /users/{userId}/bests?sport=run  ->  { success, bests: [...] } */
export async function apiGetBests(userId: number, sport: Sport = "run"): Promise<UserBest[]> {
  const r = await fetch(`${API_URL}/users/${userId}/bests?sport=${sport}`, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.detail ?? `bests load failed: ${r.status}`);
  const arr = (j?.bests ?? []).map(normalizeRow);
  return distanceOptions(sport).length ? arr.sort(sortBySportOrder(sport)) : arr;
}

/** PUT /users/{userId}/bests  (upsert) */
export async function apiSaveBest(userId: number, best: UserBest): Promise<void> {
  const sport = best.sport ?? "run";

  const payload: any = {
    sport,
    distance_m: best.distance_m,
    // DÔLEŽITÉ: ak prišlo time_sec z PBRun, pošli ho ďalej
    time_sec: (best as any).time_sec ?? best.best_time_s ?? undefined,
    // time_str pošli len vtedy, ak nemáme sekundy
    time_str:
      (best as any).time_sec != null || typeof best.best_time_s === "number"
        ? undefined
        : (best.time_str ?? undefined),

    activity_id: best.activity_id ?? undefined,
    activity_name: best.activity_name ?? undefined,
    achieved_at: best.achieved_at ?? undefined,
  };

  if (!isAllowedDistance(payload.distance_m, sport)) {
    console.warn(`[bests.save] distance ${payload.distance_m} not in map for sport=${sport}`);
  }

  const r = await fetch(`${API_URL}/users/${userId}/bests`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.detail ?? `save best failed: ${r.status}`);
}

/** DELETE /users/{userId}/bests/{sport}/{distance_m} */
export async function apiDeleteBest(userId: number, distance_m: number, sport: Sport = "run"): Promise<void> {
  const r = await fetch(`${API_URL}/users/${userId}/bests/${sport}/${distance_m}`, { method: "DELETE" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.detail ?? `delete failed: ${r.status}`);
}