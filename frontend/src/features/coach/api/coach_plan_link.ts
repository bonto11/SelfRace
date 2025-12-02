// src/features/coach/api/coach_plan_link.ts
import { API_URL } from "@/shared/config";

export type SavePlanActivityLinkResult = {
  success: boolean;
  via: "api" | "none";
};

/**
 * Manuálne prelinkovanie jednej planned session na aktivitu.
 * activityId = null → odmapovanie (unlink).
 *
 * BE endpoint: POST /coach-plan/{user_id}/link
 * Body: { session_id, activity_id|null }
 */
export async function apiSavePlanActivityLink(
  userId: number,
  sessionId: number,
  activityId: number | null
): Promise<SavePlanActivityLinkResult> {
  if (!API_URL) {
    console.warn(
      "[coach.plan_link] missing API_URL, skipping call",
      { userId, sessionId, activityId }
    );
    return { success: false, via: "none" };
  }

  const payload = {
    session_id: sessionId,
    activity_id: activityId, // null = unlink
  };

  const res = await fetch(`${API_URL}/coach-plan/${userId}/link`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(payload),
  }).catch((err) => {
    console.error("[coach.plan_link] savePlanActivityLink fetch error", err);
    return null;
  });

  if (!res || !res.ok) {
    return { success: false, via: "api" };
  }

  // Body nás teraz netrápi – stačí vedieť, že call prešiel
  return { success: true, via: "api" };
}