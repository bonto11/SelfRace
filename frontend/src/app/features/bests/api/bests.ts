// features/bests/api/bests.ts
import {
  distanceOptions,
  sortBySportOrder,
  normalizeRow,
  isAllowedDistance,
} from "@/app/features/bests/utils/bests";
import { Sport, UserBest } from "@/app/features/bests/types/bests";
import { callBackend } from "@/app/shared/utils/callBackend";

/** GET /users/{userId}/bests?sport=run  ->  { success, bests: [...] } */
export async function apiGetBests(
  userId: number,
  sport: Sport = "run"
): Promise<UserBest[]> {
  if (!userId) return [];

  const path = `/users/${encodeURIComponent(
    String(userId)
  )}/bests?sport=${encodeURIComponent(sport)}`;
  console.debug("[bests][GET] ->", path);

  try {
    const j = await callBackend<any>(path, {
      method: "GET",
      cache: "no-store",
    });

    const arr: UserBest[] = Array.isArray(j?.bests)
      ? j.bests.map(normalizeRow)
      : [];

    return distanceOptions(sport).length
      ? arr.sort(sortBySportOrder(sport))
      : arr;
  } catch (e: any) {
    console.error("[bests][GET] error", e);
    // necháme error padnúť do UI, podobne ako pôvodne pri !r.ok
    throw new Error(e?.message ?? "bests load failed");
  }
}

/** PUT /users/{userId}/bests  (upsert) */
export async function apiSaveBest(
  userId: number,
  best: UserBest
): Promise<void> {
  if (!userId) {
    throw new Error("Missing userId for apiSaveBest");
  }

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
        : best.time_str ?? undefined,
    activity_id: best.activity_id ?? undefined,
    activity_name: best.activity_name ?? undefined,
    achieved_at: best.achieved_at ?? undefined,
  };

  if (!isAllowedDistance(payload.distance_m, sport)) {
    console.warn(
      `[bests.save] distance ${payload.distance_m} not in map for sport=${sport}`
    );
  }

  const path = `/users/${encodeURIComponent(String(userId))}/bests`;
  console.debug("[bests][PUT] ->", path, "payload", payload);

  try {
    await callBackend<any>(path, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
    });
  } catch (e: any) {
    console.error("[bests][PUT] error", e);
    throw new Error(e?.message ?? "save best failed");
  }
}

/** DELETE /users/{userId}/bests/{sport}/{distance_m} */
export async function apiDeleteBest(
  userId: number,
  distance_m: number,
  sport: Sport = "run"
): Promise<void> {
  if (!userId) {
    throw new Error("Missing userId for apiDeleteBest");
  }

  const path = `/users/${encodeURIComponent(
    String(userId)
  )}/bests/${encodeURIComponent(sport)}/${encodeURIComponent(
    String(distance_m)
  )}`;
  console.debug("[bests][DELETE] ->", path);

  try {
    await callBackend<any>(path, {
      method: "DELETE",
      cache: "no-store",
    });
  } catch (e: any) {
    console.error("[bests][DELETE] error", e);
    throw new Error(e?.message ?? "delete best failed");
  }
}