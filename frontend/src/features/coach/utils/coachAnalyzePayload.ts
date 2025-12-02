// src/features/coach/utils/coachAnalyzePayload.ts
import type { CoachPrefs } from "@/features/coach/types/prefsTypes";
import type {
  AnalyzePayloadBE,
  ZonesPayload,
  ThresholdsPayload,
} from "@/features/coach/types/coachApiTypes";

function mapZones(z: any | undefined): ZonesPayload | undefined {
  if (!z) return undefined;
  return {
    hr_max: z.hr_max ?? null,
    z1_min: z.z1_min ?? null, z1_max: z.z1_max ?? null,
    z2_min: z.z2_min ?? null, z2_max: z.z2_max ?? null,
    z3_min: z.z3_min ?? null, z3_max: z.z3_max ?? null,
    z4_min: z.z4_min ?? null, z4_max: z.z4_max ?? null,
    z5_min: z.z5_min ?? null, z5_max: z.z5_max ?? null,
  };
}

function mapThresholds(t: any | undefined): ThresholdsPayload | undefined {
  if (!t) return undefined;
  return {
    sport: t.sport ?? null,
    hr_bpm: (t.hr_bpm ?? t.HR_bpm) ?? null,
    pace_sec_km: t.pace_sec_km ?? null,
    power_watt: t.power_watt ?? null,
    threshold_type: t.threshold_type ?? null,
    measurement_type: t.measurement_type ?? null,
    updated_at: t.updated_at ?? null,
  };
}

/**
 * Toto je pôvodný apiToAnalyzePayloadBE – len presunutý do utils.
 */
export function buildAnalyzePayloadFromPrefs(
  prefs: Partial<CoachPrefs>
): AnalyzePayloadBE {
  const rawModel =
    (prefs as any).polarized_model ? "polarized" :
    (prefs as any).pyramidal_model ? "pyramidal" :
    null;

  const intensity_model = (rawModel ?? "polarized") as
    | "polarized"
    | "pyramidal";

  const secondary = (prefs.secondary_mix ?? []).filter(
    (x: any) => (x?.share_pct ?? 0) > 0
  );
  const primary: string[] = [];

  if (prefs.main_sport) primary.push(prefs.main_sport);
  for (const sm of secondary) {
    if (sm?.sport && !primary.includes(sm.sport)) primary.push(sm.sport);
  }
  if (primary.length === 0) primary.push("run", "strength");

  return {
    schema_version: 2,

    weeks: prefs.weeks ?? undefined,
    goal_kind: prefs.goal_kind ?? undefined,
    plan_start_date:
      (prefs as any).plan_start_date ?? (prefs as any).start_date ?? null,

    primary_sports: primary,
    main_sport: prefs.main_sport ?? undefined,
    secondary_mix: secondary as any,

    targets: prefs.targets ?? undefined,
    rules: prefs.preferences ?? undefined,
    externals: prefs.external_activities ?? [],
    injuries: prefs.injuries ?? [],
    focus: {
      areas: prefs.focus_areas ?? [],
      avoid_zones: prefs.avoid_zones ?? [],
      rehab: prefs.rehab_focus ?? undefined,
    },

    intensity_model,
    blocks: {
      vo2max: !!prefs.vo2max_training,
      threshold: !!prefs.threshold_focus,
      ftp: !!prefs.ftp_training,
    },

    strength_settings: prefs.strength_settings ?? undefined,
    coach_voice: prefs.coach_voice ?? undefined,
    coach_tone: prefs.coach_tone ?? undefined,

    // NEW
    zones: mapZones((prefs as any).zones),
    thresholds: mapThresholds((prefs as any).thresholds),

    legacy: {
      distance: prefs.distance ?? undefined,
      current_pace: prefs.current_pace ?? undefined,
      target_pace: prefs.target_pace ?? undefined,
    },
  };
}