// src/features/coach/utils/prefs.ts
"use client";

// Storage + DB helpers pre CoachPrefs + normalizácia legacy tvarov.
import type { DayAbbrev } from "@/shared/types/day";

"use client";

import type { CoachPrefs, SportKind, Preferences } from "@/features/coach/types/prefsTypes";
import type { CoachPrefsLegacyLoose } from "@/features/coach/types/coachTypes";
import { DEFAULT_PREFS } from "@/features/coach/types/prefsTypes";
import { apiGetCoachPrefs, apiSaveCoachPrefs } from "@/features/coach/api/prefs";

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
  const raw = lsGet();
  return normalizeCoachPrefs(raw);
}

export async function refreshCoachPrefsFromDB(
  userId: number
): Promise<CoachPrefs> {
  const value = await apiGetCoachPrefs<CoachPrefs>(userId);
  const prefs = value ?? DEFAULT_PREFS;
  // ak chceš, kľudne vyhoď lsSet/broadcast, ale už to nemá vplyv na načítanie
  return prefs;
}

export async function saveCoachPrefs(
  userId: number,
  prefs: CoachPrefs
): Promise<void> {
  await apiSaveCoachPrefs(userId, prefs);
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

  const anyIn = input as any;

  // nová schéma (má targets/preferences/primary_sports)
  const hasNewShape =
    "targets" in anyIn ||
    "preferences" in anyIn ||
    "primary_sports" in anyIn;

  if (hasNewShape) {
    const prefs: Preferences = {
      days_off:
        anyIn.preferences?.days_off ??
        anyIn.days_off ??
        DEFAULT_PREFS.preferences!.days_off,
      long_run_days:
        anyIn.preferences?.long_run_days ??
        anyIn.preferred_long_run_days ??
        DEFAULT_PREFS.preferences!.long_run_days,
      avoid_back_to_back_hard:
        anyIn.preferences?.avoid_back_to_back_hard ??
        anyIn.avoid_back_to_back_hard ??
        DEFAULT_PREFS.preferences!.avoid_back_to_back_hard,
      use_zones:
        anyIn.preferences?.use_zones ??
        anyIn.use_zones ??
        DEFAULT_PREFS.preferences!.use_zones,
      avoid_two_a_day:
        anyIn.preferences?.avoid_two_a_day ??
        anyIn.avoid_two_a_day ??
        DEFAULT_PREFS.preferences!.avoid_two_a_day,
      include_strides:
        anyIn.preferences?.include_strides ??
        anyIn.include_strides ??
        DEFAULT_PREFS.preferences!.include_strides,
    };

    const result: CoachPrefs = {
      ...DEFAULT_PREFS,                  // istota, že máme všetky polia
      ...(input as CoachPrefs),          // dáta z DB
      primary_sports:
        (anyIn.primary_sports as SportKind[] | undefined) ??
        clampSports(anyIn.sports),
      preferences: prefs,
    };

    return result;
  }

  // ---- legacy → canonical ----
  const l = input as CoachPrefsLegacyLoose;

  const legacyPrefs: Preferences = {
    days_off: [],
    long_run_days: [],
    avoid_back_to_back_hard: false,
    use_zones: true,
    avoid_two_a_day: true,
  };

  const result: CoachPrefs = {
    ...DEFAULT_PREFS,
    goal_kind: (l.goal_kind ?? "improve_overall") as CoachPrefs["goal_kind"],
    distance: l.goal_distance_km ? String(l.goal_distance_km) : undefined,
    current_pace: l.current_pace ?? undefined,
    target_pace: l.target_pace ?? undefined,
    weeks: l.weeks ?? undefined,
    primary_sports: clampSports(l.sports),
    preferences: legacyPrefs,
  };

  return result;
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