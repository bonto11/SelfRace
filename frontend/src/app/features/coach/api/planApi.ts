// src/features/plan/api/planApi.ts
import { callBackend } from "@/app/shared/utils/callBackend";

/**
 * Stiahne plán z BE pre daného usera a dátumový rozsah
 * + spraví základnú normalizáciu.
 * Neobsahuje žiadny React ani cache.
 */
export async function fetchPlanRangeApi(
  userId: number,
  rangeStart: string,
  rangeEnd: string
): Promise<any[]> {
  if (userId == null) return [];

  const params = new URLSearchParams({
    date_from: rangeStart,
    date_to: rangeEnd,
  });

  const path = `/coach-plan/${encodeURIComponent(
    String(userId)
  )}?${params.toString()}`;

  console.debug("[PLAN][api] ->", path);

  try {
    const json = await callBackend<any>(path, {
      method: "GET",
      cache: "no-store",
    });

    const list: any[] = Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json?.rows)
      ? json.rows
      : [];

    const norm = (list as any[])
      .map((r, idx) => ({
        ...r,
        id: Number(r.id ?? idx),
        user_id: Number(r.user_id ?? userId),
        plan_date: String(r.plan_date).slice(0, 10),
        sport: String(r.sport ?? "other"),
      }))
      .sort((a, b) => a.plan_date.localeCompare(b.plan_date));

    return norm;
  } catch (e) {
    console.error("[PLAN][api] fetch ERROR", e);
    // Tento je často na pozadí, preto len hádžeme kľúč a nechávame ho bublať
    throw new Error("api.coach.planFetchFailed");
  }
}