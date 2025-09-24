// src/features/coach/utils/prefs.ts
// Utilities okolo preferencií – sem ide "logika" textu cieľa a pod.

import type { CoachPrefs } from "@/features/coach/types/prefsTypes";

const distLabel = (d?: string) => {
  switch ((d ?? "").toLowerCase()) {
    case "5k": return "5 km";
    case "10k": return "10 km";
    case "half": return "polmaratón";
    case "marathon": return "maratón";
    default: return d ?? "?";
  }
};

/** Postaví user-friendly text cieľa podľa CoachPrefs. */
export function buildGoalText(prefs: CoachPrefs): string {
  if (!prefs) return "Udržať kondíciu";
  if (prefs.goal_text_override?.trim()) return prefs.goal_text_override.trim();

  const kind = prefs.goal_kind ?? "maintain";
  if (kind === "race_time") {
    const dist = distLabel(prefs.distance);
    const cur = prefs.current_pace || "?";
    const tgt = prefs.target_pace || "?";
    return `Zlepšiť čas na ${dist} (aktuálne ${cur}/km → cieľ ${tgt}/km)`;
  }
  if (kind === "improve_speed") return "Zlepšiť rýchlosť";
  if (kind === "improve_endurance") return "Zlepšiť vytrvalosť";
  if (kind === "improve_overall") return "Zlepšiť celkovo";
  return "Udržať kondíciu";
}

/** Jednoduchá validácia, či máme minimum pre spustenie analýzy. */
export function hasAnalyzeMinimum(prefs: CoachPrefs | null): boolean {
  if (!prefs) return false;
  const sports = prefs.primary_sports ?? prefs.sports ?? [];
  return !!prefs.weeks && sports.length > 0;
}