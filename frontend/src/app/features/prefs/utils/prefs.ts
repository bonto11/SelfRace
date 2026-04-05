// src/features/coach/utils/prefs.ts
"use client";

import type {
  CoachPrefs,
  SportKind,
  Preferences,
  TrainingBlocks,
  IntensityModel,
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

const SPORT_SET = new Set<SportKind>(["run", "ride", "swim"]);

const clampSports = (xs?: unknown): SportKind[] | undefined => {
  if (!Array.isArray(xs)) return undefined;
  const out = xs.filter(
    (s): s is SportKind =>
      typeof s === "string" && SPORT_SET.has(s as SportKind),
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

function normalizeTwoADay(incomingPrefs: any, anyIn: any) {
  const legacyAvoidTwoA: boolean =
    !!incomingPrefs?.avoid_two_a_day || !!anyIn?.avoid_two_a_day || false;

  const incomingTwoA = incomingPrefs?.two_a_day;

  const two_a_day =
    incomingTwoA && typeof incomingTwoA === "object"
      ? {
          enabled: !!incomingTwoA.enabled,
          max_days_per_week:
            typeof incomingTwoA.max_days_per_week === "number"
              ? Math.max(
                  0,
                  Math.min(2, Math.floor(incomingTwoA.max_days_per_week)),
                )
              : 2,
        }
      : legacyAvoidTwoA
        ? { enabled: false, max_days_per_week: 0 }
        : { enabled: true, max_days_per_week: 2 };

  return two_a_day;
}

function normalizeIntensityModel(
  incomingPrefs: any,
  anyIn: any,
): IntensityModel {
  if (incomingPrefs?.intensity_model === "pyramidal") return "pyramidal";
  if (incomingPrefs?.intensity_model === "polarized") return "polarized";

  const oldPyr = !!anyIn?.pyramidal_model;
  if (oldPyr) return "pyramidal";
  return "polarized";
}

function normalizeTrainingBlocks(
  incomingPrefs: any,
  anyIn: any,
): TrainingBlocks {
  const b = incomingPrefs?.training_blocks;
  if (b && typeof b === "object") {
    return {
      vo2max: !!b.vo2max,
      ftp: !!b.ftp,
      threshold: !!b.threshold,
    };
  }

  return {
    vo2max: !!anyIn?.vo2max_training,
    ftp: !!anyIn?.ftp_training,
    threshold: !!anyIn?.threshold_focus,
  };
}

/* -------------------- public API -------------------- */

export function readCoachPrefsFromStorage(): CoachPrefs {
  const raw = lsGet();
  return normalizeCoachPrefs(raw);
}

export async function refreshCoachPrefsFromDB(
  userId: number,
): Promise<CoachPrefs> {
  const raw = await apiFetchUserPref(userId, KEY);

  let value: any = raw;

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
  prefs: CoachPrefs,
): Promise<void> {
  await apiUpsertUserPref(userId, KEY, prefs);
  lsSet(prefs);
  broadcast(prefs);
}

export function clearCoachPrefsCache() {
  lsClear();
}

/**
 * Normalization
 */
export function normalizeCoachPrefs(
  input: CoachPrefs | CoachPrefsLegacyLoose | null | undefined,
): CoachPrefs {
  if (!input) return DEFAULT_PREFS;

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
    "main_sport" in anyIn ||
    "add_on_sports" in anyIn ||
    "strength_settings" in anyIn ||
    "volume" in anyIn ||
    "weeks" in anyIn ||
    "start_date" in anyIn ||
    "end_date" in anyIn;

  if (hasAnyNew) {
    const incomingPrefs = (anyIn.preferences ?? {}) as any;

    const two_a_day = normalizeTwoADay(incomingPrefs, anyIn);
    const intensity_model = normalizeIntensityModel(incomingPrefs, anyIn);
    const training_blocks = normalizeTrainingBlocks(incomingPrefs, anyIn);

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
      two_a_day,

      intensity_model,
      training_blocks,
      hr_zone_calc_mode:
        incomingPrefs.hr_zone_calc_mode ??
        DEFAULT_PREFS.preferences!.hr_zone_calc_mode,
      womens_health: incomingPrefs.womens_health ?? DEFAULT_PREFS.preferences!.womens_health,
    };

    const mainSport: SportKind | null =
      anyIn.main_sport && SPORT_SET.has(anyIn.main_sport)
        ? (anyIn.main_sport as SportKind)
        : (DEFAULT_PREFS.main_sport ?? "run");

    const addOnsRaw = Array.isArray(anyIn.add_on_sports)
      ? (clampSports(anyIn.add_on_sports) ?? [])
      : [];

    const addOns = mainSport
      ? addOnsRaw.filter((s) => s !== mainSport)
      : addOnsRaw;

    const result: CoachPrefs = {
      ...DEFAULT_PREFS,
      ...(anyIn as any),

      main_sport: mainSport,
      add_on_sports: addOns,

      preferences: prefs,
    };

    if ("external_activities" in (result as any))
      delete (result as any).external_activities;

    delete (result as any).polarized_model;
    delete (result as any).pyramidal_model;
    delete (result as any).vo2max_training;
    delete (result as any).ftp_training;
    delete (result as any).threshold_focus;

    delete (result as any).weekly_template;
    delete (result as any).injuries;

    if (
      (result as any)?.preferences &&
      "include_strides" in (result as any).preferences
    ) {
      delete (result as any).preferences.include_strides;
    }

    return result;
  }

  const l = anyIn as CoachPrefsLegacyLoose;

  const legacyPrefs: Preferences = {
    ...DEFAULT_PREFS.preferences!,
  };

  const result: CoachPrefs = {
    ...DEFAULT_PREFS,
    goal_kind: (l.goal_kind ??
      DEFAULT_PREFS.goal_kind) as CoachPrefs["goal_kind"],
    weeks: l.weeks ?? DEFAULT_PREFS.weeks,
    preferences: legacyPrefs,
  };

  const sports = clampSports((l as any).sports);
  if (sports && sports.length) {
    result.main_sport = sports[0] ?? result.main_sport ?? "run";
    result.add_on_sports = sports
      .slice(1)
      .filter((s) => s !== result.main_sport);
  }

  return result;
}

export function subscribeCoachPrefs(
  cb: (prefs: CoachPrefs) => void,
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
        // ignore
      }
    }
  };

  window.addEventListener(EVT, onEvt);
  window.addEventListener("storage", onStorage);

  const cur = readCoachPrefsFromStorage();
  setTimeout(() => cb(cur), 0);

  return () => {
    window.removeEventListener(EVT, onEvt);
    window.removeEventListener("storage", onStorage);
  };
}