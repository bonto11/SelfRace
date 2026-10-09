// src/app/features/coach/utils/enableAdvisor.ts
import type { CoachPrefs } from "@/app/features/prefs/types/prefs";
import { refreshCoachPrefsFromDB, saveCoachPrefs } from "@/app/features/prefs/utils/prefs";
import { apiStartManualPlan } from "@/app/features/coach/api/advisor_daily";

export type EnableAdvisorResult = "ok" | "coach_plan_active" | "error";

/**
 * „Zapnúť AI poradcu“ jedným ťuknutím: advisor režim + prázdny aktívny plán.
 *
 * PREČO: kto si tréningy skladá sám (napr. len posilňovňa), potreboval
 * doteraz nájsť v nastaveniach trénera prepínač režimu a potom „Začať plán“.
 * Advisor mu AI plán nikdy negeneruje – len hodnotí týždeň, radí a navrhne
 * doplnenie (napr. kardio) cez šablóny.
 *
 * Plán od AI trénera (coach režim) sa nikdy neprepína – z advisora by sa
 * kvôli bežiacemu plánu nedalo vrátiť (_guard_coach_mode_switch na BE).
 */
export async function enableAdvisorPlan(
  userId: number,
  opts: { hasActivePlan: boolean },
): Promise<EnableAdvisorResult> {
  try {
    const fresh = ((await refreshCoachPrefsFromDB(userId)) || {}) as any;
    const isAdvisor = fresh.coach_mode === "advisor";

    if (!isAdvisor) {
      if (opts.hasActivePlan) return "coach_plan_active";
      // len coach_mode nad čerstvými prefs – ako prepínač v nastaveniach trénera
      const { external_activities: _ext, ...base } = fresh;
      await saveCoachPrefs(userId, { ...base, coach_mode: "advisor" } as CoachPrefs);
    }

    // advisor s bežiacim plánom už má kam pridávať tréningy
    if (opts.hasActivePlan) return "ok";

    const res = await apiStartManualPlan(userId);
    if (res.success || res.error_code === "active_plan_exists") return "ok";
    return "error";
  } catch (e) {
    console.error("[enableAdvisorPlan] error", e);
    return "error";
  }
}
