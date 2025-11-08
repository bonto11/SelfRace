"use client";

import type { CoachPrefs } from "@/features/coach/types/prefsTypes";
import { DEFAULT_PREFS } from "@/features/coach/types/prefsTypes";
import { fetchUserPref, upsertUserPref } from "@/shared/api/userPrefs";
import type { CoachPrefsLegacyLoose } from "@/features/coach/types/coach";
import type { SportKind } from "@/features/coach/types/prefsTypes";

const KEY = "coach.prefs";
const LS_KEY = "up:coach.prefs";

const SPORT_SET = new Set(["run","ride","strength","mixed","skate"]);

const clampSports = (xs?: string[] | null): SportKind[] | undefined =>
  xs?.filter((s): s is SportKind => SPORT_SET.has(s as SportKind)) || undefined;

// --- localStorage cache ---
function lsGet(): CoachPrefs | null {
  try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function lsSet(p: CoachPrefs) { try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch {} }
function lsClear()           { try { localStorage.removeItem(LS_KEY); } catch {} }

// --- public ---
export function readCoachPrefsFromStorage(): CoachPrefs {
  return lsGet() ?? DEFAULT_PREFS;
}

export async function refreshCoachPrefsFromDB(userId: number): Promise<CoachPrefs> {
  const value = await fetchUserPref(userId, KEY);
  if (value) { lsSet(value); return value as CoachPrefs; }
  return DEFAULT_PREFS;
}

export async function saveCoachPrefs(userId: number, prefs: CoachPrefs): Promise<void> {
  await upsertUserPref(userId, KEY, prefs);
  lsSet(prefs);
}

export function clearCoachPrefsCache() { lsClear(); }

// ---- Normalizácia (legacy → canonical) ----
export function normalizeCoachPrefs(input: CoachPrefs | CoachPrefsLegacyLoose | null | undefined): CoachPrefs {
  if (!input) return DEFAULT_PREFS;

  if ("targets" in input || "preferences" in input || "primary_sports" in input) {
    const i = input as CoachPrefs;
    return {
      ...DEFAULT_PREFS,
      ...i,
      primary_sports: (i.primary_sports as SportKind[] | undefined) ?? clampSports(i.sports),
      preferences: i.preferences ?? {
        days_off: [],
        avoid_back_to_back_hard: !!(i as any).prefer_two_hard_days_apart,
        use_zones: true,
        wu_cd_detail: !!(i as any).include_wu_cd_details,
        long_run_days: (i as any).preferred_long_run_days,
      },
    };
  }

  const l = input as CoachPrefsLegacyLoose;
  return {
    ...DEFAULT_PREFS,
    goal_kind: (l.goal_kind ?? "improve_overall") as CoachPrefs["goal_kind"],
    distance: l.goal_distance_km ? String(l.goal_distance_km) : undefined,
    current_pace: l.current_pace ?? undefined,
    target_pace: l.target_pace ?? undefined,
    weeks: l.weeks ?? undefined,
    primary_sports: clampSports(l.sports),
  };
}