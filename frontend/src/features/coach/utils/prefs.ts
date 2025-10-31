// src/features/coach/utils/prefs.ts
"use client";

import type { CoachPrefs } from "@/features/coach/types/prefsTypes";
import { fetchUserPref, upsertUserPref } from "@/shared/api/userPrefs";

const KEY = "coach.prefs";
const LS_KEY = "up:coach.prefs";

const DEFAULT_PREFS: CoachPrefs = {
  goal_kind: "improve_overall",
  weeks: undefined,
  primary_sports: ["run"],
  preferences: {
    days_off: [],
    long_run_days: [],
    avoid_back_to_back_hard: true,
    use_zones: true,
    wu_cd_detail: true,
  },
  targets: {
    run: {
      race_goal: null,
      current_best_time: null,
      target_time: null,
      longest_recent_distance_km: null,
    },
    ride: { focus: "endurance", weekly_time_target_min: null },
    strength: { focus: "general", sessions_per_week: 2 },
  },
};

// --- localStorage ---
function lsGet(): CoachPrefs | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function lsSet(p: CoachPrefs) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch {}
}
function lsClear() {
  try { localStorage.removeItem(LS_KEY); } catch {}
}

// --- verejné funkcie ---
export function readCoachPrefsFromStorage(): CoachPrefs {
  return lsGet() ?? DEFAULT_PREFS;
}

export async function refreshCoachPrefsFromDB(userId: number): Promise<CoachPrefs> {
  const value = await fetchUserPref(userId, KEY);
  if (value) {
    lsSet(value);
    return value;
  }
  return DEFAULT_PREFS;
}

export async function saveCoachPrefs(userId: number, prefs: CoachPrefs): Promise<void> {
  await upsertUserPref(userId, KEY, prefs);
  lsSet(prefs);
}

export function clearCoachPrefsCache() {
  lsClear();
}