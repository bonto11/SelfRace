// src/features/coach/utils/prefs.ts
"use client";

import type {
  CoachPrefs,
  SportKind,
  Preferences,
  WeeklyTemplate,
} from "@/app/features/prefs/types/prefs";
import type { CoachPrefsLegacyLoose } from "@/app/features/coach/types/coachTypes";
import { DEFAULT_PREFS } from "@/app/features/prefs/types/prefs";
import {
  apiFetchUserPref,
  apiUpsertUserPref,
} from "@/app/features/prefs/api/prefs";

/** DB key + LS cache key */
const KEY = "coach.prefs";
const LS_KEY = "up:coach.prefs";

/** Internal custom event – local “live” updates */
const EVT = "coach:prefs-updated";

/* -------------------- helpers -------------------- */

// SportKind = "run" | "ride" | "swim"  (podľa tvojich types)
const SPORT_SET = new Set<SportKind>(["run", "ride", "swim"]);

const clampSports = (xs?: unknown): SportKind[] | undefined => {
  if (!Array.isArray(xs)) return undefined;
  const out = xs.filter(
    (s): s is SportKind => typeof s === "string" && SPORT_SET.has(s as SportKind)
  );
  return out.length ? out : undefined;
};

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

function broadcast(prefs: CoachPrefs) {
  try {
    window.dispatchEvent(new CustomEvent(EVT, { detail: prefs }));
  } catch {
    // ignore
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
  const raw = await apiFetchUserPref(userId, KEY);

  let value: any = raw;

  // niekedy API vráti wrapper { success, key, value }
  if (
    value &&
    typeof value === "object" &&
    "value" in value &&
    !("goal_kind" in value)
  ) {
    value = (value as any).value;
  }

  const prefs = normalizeCoachPrefs(value as any);
  lsSet(prefs);
  broadcast(prefs);
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
 * Normalization:
 * - supports new schema (main_sport + add_on_sports + preferences.two_a_day + strength_settings + weekly_template)
 * - supports older “new-ish” schema (avoid_two_a_day boolean, preferred_long_run_days, etc.)
 * - supports legacy loose schema (CoachPrefsLegacyLoose) — mapne len to, čo existuje v CoachPrefs
 */
export function normalizeCoachPrefs(
  input: CoachPrefs | CoachPrefsLegacyLoose | null | undefined
): CoachPrefs {
  if (!input) return DEFAULT_PREFS;

  // allow string payloads
  let anyIn: any = input;
  if (typeof anyIn === "string") {
    try {
      anyIn = JSON.parse(anyIn);
    } catch {
      return DEFAULT_PREFS;
    }
  }
  if (!anyIn || typeof anyIn !== "object") return DEFAULT_PREFS;

  const hasAnyNew =
    "preferences" in anyIn ||
    "targets" in anyIn ||
    "weekly_template" in anyIn ||
    "main_sport" in anyIn ||
    "add_on_sports" in anyIn ||
    "strength_settings" in anyIn ||
    "volume" in anyIn ||
    "weeks" in anyIn ||
    "start_date" in anyIn;

  if (hasAnyNew) {
    const incomingPrefs = (anyIn.preferences ?? {}) as any;

    // --- two_a_day migration ---
    // NEW: preferences.two_a_day: { enabled, max_days_per_week }
    // OLD: avoid_two_a_day: boolean  (true means: avoid -> disable 2-a-day)
    // OLD (nested): preferences.avoid_two_a_day: boolean
    const legacyAvoidTwoA: boolean =
      !!incomingPrefs.avoid_two_a_day ||
      !!anyIn.avoid_two_a_day ||
      false;

    const incomingTwoA = incomingPrefs.two_a_day;
    const two_a_day =
      incomingTwoA && typeof incomingTwoA === "object"
        ? {
            enabled: !!incomingTwoA.enabled,
            max_days_per_week:
              typeof incomingTwoA.max_days_per_week === "number"
                ? Math.max(
                    0,
                    Math.min(2, Math.floor(incomingTwoA.max_days_per_week))
                  )
                : 2,
          }
        : legacyAvoidTwoA
          ? { enabled: false, max_days_per_week: 0 }
          : { enabled: true, max_days_per_week: 2 };

    const prefs: Preferences = {
      days_off:
        incomingPrefs.days_off ??
        anyIn.days_off ??
        DEFAULT_PREFS.preferences!.days_off,
      long_run_days:
        incomingPrefs.long_run_days ??
        anyIn.preferred_long_run_days ??
        DEFAULT_PREFS.preferences!.long_run_days,
      avoid_back_to_back_hard:
        incomingPrefs.avoid_back_to_back_hard ??
        anyIn.avoid_back_to_back_hard ??
        DEFAULT_PREFS.preferences!.avoid_back_to_back_hard,
      use_zones:
        incomingPrefs.use_zones ??
        anyIn.use_zones ??
        DEFAULT_PREFS.preferences!.use_zones,
      include_strides:
        incomingPrefs.include_strides ??
        anyIn.include_strides ??
        DEFAULT_PREFS.preferences!.include_strides,
      two_a_day,
    };

    // sanitize sports
    const mainSport: SportKind | null =
      anyIn.main_sport && SPORT_SET.has(anyIn.main_sport)
        ? (anyIn.main_sport as SportKind)
        : DEFAULT_PREFS.main_sport ?? "run";

    const addOnsRaw = Array.isArray(anyIn.add_on_sports)
      ? clampSports(anyIn.add_on_sports) ?? []
      : [];

    const addOns = mainSport
      ? addOnsRaw.filter((s) => s !== mainSport)
      : addOnsRaw;

    const wt: WeeklyTemplate | null | undefined = anyIn.weekly_template;
    const weekly_template =
      wt && typeof wt === "object" ? wt : DEFAULT_PREFS.weekly_template;

    const result: CoachPrefs = {
      ...DEFAULT_PREFS,
      ...(anyIn as any),

      // enforce canonical sports fields
      main_sport: mainSport,
      add_on_sports: addOns,

      // enforce prefs
      preferences: prefs,

      // weekly template always exists
      weekly_template,
    };

    // Drop old external_activities if it leaked into payloads
    if ("external_activities" in (result as any)) {
      delete (result as any).external_activities;
    }

    return result;
  }

  // ---- legacy loose → canonical (len polia, čo existujú v CoachPrefs types) ----
  const l = anyIn as CoachPrefsLegacyLoose;

  const legacyPrefs: Preferences = {
    ...DEFAULT_PREFS.preferences!,
    // ak si chceš zachovať defaulty z DEFAULT_PREFS, nechaj takto
  };

  const result: CoachPrefs = {
    ...DEFAULT_PREFS,
    goal_kind: (l.goal_kind ?? DEFAULT_PREFS.goal_kind) as CoachPrefs["goal_kind"],
    weeks: l.weeks ?? DEFAULT_PREFS.weeks,
    preferences: legacyPrefs,
  };

  // legacy “sports” -> použijeme main_sport + add_on_sports (bez share/role)
  const sports = clampSports((l as any).sports);
  if (sports && sports.length) {
    result.main_sport = sports[0] ?? result.main_sport ?? "run";
    result.add_on_sports = sports.slice(1).filter((s) => s !== result.main_sport);
  }

  return result;
}

/* -------------------- live hook helpers -------------------- */

export function subscribeCoachPrefs(cb: (prefs: CoachPrefs) => void): () => void {
  const onEvt = (e: Event) => {
    const ce = e as CustomEvent<CoachPrefs>;
    if (ce?.detail) cb(ce.detail);
  };

  const onStorage = (e: StorageEvent) => {
    if (e.key === LS_KEY && e.newValue) {
      try {
        cb(JSON.parse(e.newValue) as CoachPrefs);
      } catch {
        // ignore
      }
    }
  };

  window.addEventListener(EVT, onEvt);
  window.addEventListener("storage", onStorage);

  // initial push
  const cur = readCoachPrefsFromStorage();
  setTimeout(() => cb(cur), 0);

  return () => {
    window.removeEventListener(EVT, onEvt);
    window.removeEventListener("storage", onStorage);
  };
}