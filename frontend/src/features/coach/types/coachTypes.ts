// src/features/coach/types/coach.ts
// Základné typy pre coach modul, ktoré nemajú priame UI prepojenie.
import type { DayAbbrev } from "@/shared/types/day";

/**
 * Pôvodná (legacy) podoba CoachPrefs, používaná v starších verziách.
 * normalizeCoachPrefs ju mapuje na nový typ CoachPrefs.
 */
/** Pôvodná (legacy) podoba CoachPrefs, používaná v starších verziách. */
export type CoachPrefsLegacyLoose = {
  goal_kind?: string | null;
  goal_distance_km?: number | null;
  current_pace?: string | null;
  target_pace?: string | null;
  weeks?: number | null;
  sports?: string[];
  notes?: string | null;
  preferred_long_run_days?: DayAbbrev[] | null;
  avoid_back_to_back_hard?: boolean | null;
  avoid_two_a_day?: boolean | null;

  other?: Record<string, unknown>;
};