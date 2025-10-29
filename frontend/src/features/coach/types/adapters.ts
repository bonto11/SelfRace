import type { CoachPrefs as CanonPrefs, Preferences, SportKind } from "./prefsTypes";
import type { CoachPrefsLegacyLoose } from "./coach";

const SPORT_SET = new Set<SportKind>(["run","ride","strength","mixed","skate"]);
const clampSports = (xs?: string[] | null): SportKind[] | undefined =>
  xs?.filter((s): s is SportKind => SPORT_SET.has(s as SportKind)) || undefined;

// prevod všetkých historických/voľných tvarov na kanonický
export function normalizeCoachPrefs(input: CanonPrefs | CoachPrefsLegacyLoose | null | undefined): CanonPrefs {
  if (!input) return {} as CanonPrefs;

  // keď už vyzerá kanonicky, len dotiahni drobnosti
  if ("targets" in input || "preferences" in input || "primary_sports" in input) {
    const i = input as CanonPrefs;
    return {
      ...i,
      primary_sports: i.primary_sports ?? clampSports(i.sports),
      preferences: i.preferences ?? {
        days_off: [],
        avoid_back_to_back_hard: !!i.prefer_two_hard_days_apart,
        use_zones: true,
        wu_cd_detail: !!i.include_wu_cd_details,
        long_run_days: i.preferred_long_run_days,
      },
    };
  }

  // legacy loose → kanonický
  const l = input as CoachPrefsLegacyLoose;
  const prefs: Preferences = {
    days_off: [],
    long_run_days: undefined,
    avoid_back_to_back_hard: false,
    use_zones: true,
    wu_cd_detail: true,
  };

  return {
    goal_kind: l.goal_kind as CanonPrefs["goal_kind"],
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
    preferences: prefs,
  };
}