// src/features/coach/utils/prefs.ts
"use client";

// Storage + DB helpers pre CoachPrefs + normalizácia legacy tvarov.
import type { DayAbbrev } from "@/shared/types/day";

import type {
  CoachPrefs,
  SportKind,
  Preferences,
} from "@/features/coach/types/prefsTypes";
import { DEFAULT_PREFS } from "@/features/coach/types/prefsTypes";
import { apiFetchUserPref, apiUpsertUserPref } from "@/shared/api/userPrefs";
import type { CoachPrefsLegacyLoose } from "@/features/coach/types/coachTypes";

/** Kľúče pre DB/LS */
const KEY = "coach.prefs"; // meno preferencie v user_prefs
const LS_KEY = "up:coach.prefs"; // localStorage cache

/** Interný custom event – na lokálne „live“ aktualizácie */
const EVT = "coach:prefs-updated";

/* -------------------- helpers -------------------- */

const SPORT_SET = new Set(["run", "ride", "strength", "mixed", "skate", "swim"]);

const clampSports = (xs?: string[] | null): SportKind[] | undefined =>
  xs?.filter((s): s is SportKind => SPORT_SET.has(s as SportKind)) || undefined;

function lsGet(): CoachPrefs | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as CoachPrefs) : null;
  } catch {
    return null;
  }
}
function lsSet(p: CoachPrefs) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
}
function lsClear() {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    // ignore
  }
}

/** Odošli custom event o zmene prefs (pre „live“ widgety). */
function broadcast(prefs: CoachPrefs) {
  try {
    window.dispatchEvent(new CustomEvent(EVT, { detail: prefs }));
  } catch {
    // no-op
  }
}

/* -------------------- public API -------------------- */

export function readCoachPrefsFromStorage(): CoachPrefs {
  return lsGet() ?? DEFAULT_PREFS;
}

export async function refreshCoachPrefsFromDB(
  userId: number
): Promise<CoachPrefs> {
  const value = await apiFetchUserPref(userId, KEY);

  // nenechávame surové, vždy normalizujeme
  const prefs = normalizeCoachPrefs(value as any);
  lsSet(prefs);
  broadcast(prefs); // nech sa widgety hneď refreshnú
  return prefs;
}

export async function saveCoachPrefs(
  userId: number,
  prefs: CoachPrefs
): Promise<void> {
  await apiUpsertUserPref(userId, KEY, prefs);
  lsSet(prefs);
  broadcast(prefs);
}

export function clearCoachPrefsCache() {
  lsClear();
}

/**
 * Legacy → canonical CoachPrefs.
 * Stará schéma (CoachPrefsLegacyLoose) sa tu premapuje na nový typ.
 */
export function normalizeCoachPrefs(
  input: CoachPrefs | CoachPrefsLegacyLoose | null | undefined
): CoachPrefs {
  if (!input) return DEFAULT_PREFS;

  // ak to už vyzerá ako nový tvar → len doplníme primary_sports + preferences
  if ("targets" in input || "preferences" in input || "primary_sports" in input) {
    const anyIn = input as any;
    const i = input as CoachPrefs;

    const prefs: Preferences = {
      days_off: i.preferences?.days_off ?? [],
      long_run_days:
        i.preferences?.long_run_days ??
        (anyIn.preferred_long_run_days as DayAbbrev[] | undefined) ??
        [],
      avoid_back_to_back_hard:
        i.preferences?.avoid_back_to_back_hard ??
        !!anyIn.avoid_back_to_back_hard,
      use_zones: i.preferences?.use_zones ?? true,
      avoid_two_a_day:
        i.preferences?.avoid_two_a_day ?? !!anyIn.avoid_two_a_day,
      include_strides: i.preferences?.include_strides,
    };

    return {
      ...i,
      primary_sports:
        (i.primary_sports as SportKind[] | undefined) ??
        clampSports(anyIn.sports),
      preferences: prefs,
    };
  }

  // ------- legacy loose -> canonical -------
  const l = input as CoachPrefsLegacyLoose;

  const legacyPrefs: Preferences = {
    days_off: [],
    long_run_days: [],
    avoid_back_to_back_hard: !!l.avoid_back_to_back_hard,
    use_zones: true,
    avoid_two_a_day: !!l.avoid_two_a_day,
  };

  return {
    goal_kind: (l.goal_kind ?? "improve_overall") as CoachPrefs["goal_kind"],
    distance: l.goal_distance_km ? String(l.goal_distance_km) : undefined,
    current_pace: l.current_pace ?? undefined,
    target_pace: l.target_pace ?? undefined,
    weeks: l.weeks ?? undefined,
    primary_sports: clampSports(l.sports),

    targets: {
      run: {
        races: [],
        race_goal: null,
        custom_distance_km: null,
        current_best_time: null,
        target_time: null,
        longest_recent_distance_km: null,
        priority: null,
        race_type: null,
        terrain: null,
        elevation_profile: null,
      },
      ride: { focus: "endurance", weekly_time_target_min: null },
      strength: { focus: "general", sessions_per_week: 2 },
    },

    preferences: legacyPrefs,
  };
}

/* -------------------- live hook helpers -------------------- */

/** Subscribe na lokálne zmeny prefs (CustomEvent + cross-tab storage). */
export function subscribeCoachPrefs(
  cb: (prefs: CoachPrefs) => void
): () => void {
  const onEvt = (e: Event) => {
    const ce = e as CustomEvent<CoachPrefs>;
    if (ce?.detail) cb(ce.detail);
  };

  const onStorage = (e: StorageEvent) => {
    if (e.key === LS_KEY && e.newValue) {
      try {
        cb(JSON.parse(e.newValue) as CoachPrefs);
      } catch {
        /* ignore */
      }
    }
  };

  window.addEventListener(EVT, onEvt);
  window.addEventListener("storage", onStorage);

  // initial push (keď sa niekto subscribe-ne neskôr)
  const cur = readCoachPrefsFromStorage();
  if (cur) setTimeout(() => cb(cur), 0);

  return () => {
    window.removeEventListener(EVT, onEvt);
    window.removeEventListener("storage", onStorage);
  };
}