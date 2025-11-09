"use client";

import type { CoachPrefs } from "@/features/coach/types/prefsTypes";
import { DEFAULT_PREFS } from "@/features/coach/types/prefsTypes";
import { fetchUserPref, upsertUserPref } from "@/shared/api/userPrefs";
import type { CoachPrefsLegacyLoose } from "@/features/coach/types/coach";
import type { SportKind } from "@/features/coach/types/prefsTypes";

/** Kľúče pre DB/LS */
const KEY = "coach.prefs";
const LS_KEY = "up:coach.prefs";

/** Interný custom event – na lokálne „live“ aktualizácie */
const EVT = "coach:prefs-updated";

/* -------------------- helpers -------------------- */
const SPORT_SET = new Set(["run","ride","strength","mixed","skate"]);

const clampSports = (xs?: string[] | null): SportKind[] | undefined =>
  xs?.filter((s): s is SportKind => SPORT_SET.has(s as SportKind)) || undefined;

function lsGet(): CoachPrefs | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function lsSet(p: CoachPrefs) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch {}
}
function lsClear() {
  try { localStorage.removeItem(LS_KEY); } catch {}
}

/** Odošli custom event o zmene prefs (pre „live“ widgety) */
function broadcast(prefs: CoachPrefs) {
  try {
    window.dispatchEvent(new CustomEvent(EVT, { detail: prefs }));
  } catch { /* no-op */ }
}

/* -------------------- public API -------------------- */
export function readCoachPrefsFromStorage(): CoachPrefs {
  return lsGet() ?? DEFAULT_PREFS;
}

export async function refreshCoachPrefsFromDB(userId: number): Promise<CoachPrefs> {
  const value = await fetchUserPref(userId, KEY);
  const prefs = value ? (value as CoachPrefs) : DEFAULT_PREFS;
  lsSet(prefs);
  broadcast(prefs); // <<< dôležité: nech sa widgety hneď refreshnú
  return prefs;
}

export async function saveCoachPrefs(userId: number, prefs: CoachPrefs): Promise<void> {
  await upsertUserPref(userId, KEY, prefs);
  lsSet(prefs);
  broadcast(prefs); // <<< dôležité: zmeny sa prejavia okamžite
}

export function clearCoachPrefsCache() { lsClear(); }

/** „Legacy → canonical“ – ostáva kvôli kompatibilite */
export function normalizeCoachPrefs(input: CoachPrefs | CoachPrefsLegacyLoose | null | undefined): CoachPrefs {
  if (!input) return DEFAULT_PREFS;

  // už kanonický tvar
  if ("targets" in input || "preferences" in input || "primary_sports" in input) {
    const i = input as CoachPrefs;
    return {
      ...i,
      primary_sports: (i.primary_sports as SportKind[] | undefined) ?? clampSports(i.sports),
      preferences: i.preferences ?? {
        days_off: [],
        avoid_back_to_back_hard: !!i.prefer_two_hard_days_apart,
        use_zones: true,
        wu_cd_detail: !!i.include_wu_cd_details,
        long_run_days: i.preferred_long_run_days,
      },
    };
  }

  // legacy loose → canonical
  const l = input as CoachPrefsLegacyLoose;
  return {
    goal_kind: (l.goal_kind ?? "improve_overall") as CoachPrefs["goal_kind"],
    distance: l.goal_distance_km ? String(l.goal_distance_km) : undefined,
    current_pace: l.current_pace ?? undefined,
    target_pace: l.target_pace ?? undefined,
    weeks: l.weeks ?? undefined,
    primary_sports: clampSports(l.sports),
    targets: {
      run: { race_goal: null, current_best_time: null, target_time: null, longest_recent_distance_km: null },
      ride: { focus: "endurance", weekly_time_target_min: null },
      strength: { focus: "general", sessions_per_week: 2 },
    },
    preferences: {
      days_off: [],
      long_run_days: undefined,
      avoid_back_to_back_hard: false,
      use_zones: true,
      wu_cd_detail: true,
    },
  };
}

/* -------------------- live hook helpers -------------------- */
/** Subscribe na lokálne zmeny prefs (CustomEvent + cross-tab storage) */
export function subscribeCoachPrefs(cb: (prefs: CoachPrefs) => void): () => void {
  const onEvt = (e: Event) => {
    const ce = e as CustomEvent<CoachPrefs>;
    if (ce?.detail) cb(ce.detail);
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === LS_KEY && e.newValue) {
      try { cb(JSON.parse(e.newValue)); } catch {/* ignore */}
    }
  };
  window.addEventListener(EVT, onEvt);
  window.addEventListener("storage", onStorage);
  // initial push (pre prípad, že niekto subscribe-ne neskôr)
  const cur = readCoachPrefsFromStorage();
  if (cur) setTimeout(() => cb(cur), 0);
  return () => {
    window.removeEventListener(EVT, onEvt);
    window.removeEventListener("storage", onStorage);
  };
}