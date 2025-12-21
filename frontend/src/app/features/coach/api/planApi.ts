// src/features/plan/api/planApi.ts
import { API_URL } from "@/app/shared/config";

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

  if (!API_URL) {
    console.error("[PLAN][api] Missing API_URL");
    return [];
  }

  const url = `${API_URL}/coach-plan/${userId}?date_from=${rangeStart}&date_to=${rangeEnd}`;

  try {
    const res = await fetch(url, { cache: "no-store" });

    const rawText = await res.text();
    let json: any = {};
    try {
      json = rawText ? JSON.parse(rawText) : {};
    } catch (e) {
      console.error("[PLAN][api] JSON parse error", e);
      return [];
    }

    if (!res.ok) {
      console.error("[PLAN][api] HTTP error", {
        status: res.status,
        body: json,
      });
      return [];
    }

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
    return [];
  }
}
