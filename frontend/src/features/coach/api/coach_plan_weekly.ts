// src/features/coach/api/plan_weekly.ts
import { API_URL } from "@/shared/config";

export type WeeklyPlanGenerateOptions = {
  overwrite?: boolean;
  state_id?: number | null; // id z coach_athlete_state, ak chceš konkrétny
  weeks?: number | null;    // koľko týždňov plánu
};

async function robustJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await res.json();
  const text = await res.text().catch(() => "");
  return { success: false, detail: text || `HTTP ${res.status}` };
}

/**
 * Vygeneruje / prepíše weekly plán:
 * volá POST /coach-plan-weekly/generate/{user_id}
 */
export async function apiGenerateWeeklyPlan(
  userId: number,
  opts: WeeklyPlanGenerateOptions = {}
): Promise<any> {
  if (!API_URL) throw new Error("API_URL is not configured");

  const payload = {
    overwrite: opts.overwrite ?? true,
    state_id: opts.state_id ?? null,
    weeks: opts.weeks ?? null,
  };

  const res = await fetch(
    `${API_URL}/coach-plan-weekly/generate/${userId}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }
  ).catch((err) => {
    throw new Error(`Network/CORS: ${String(err)}`);
  });

  const json = await robustJson(res);
  if (!res.ok) {
    throw new Error(json?.detail || `HTTP ${res.status}`);
  }
  return json;
}