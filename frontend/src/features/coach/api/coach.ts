// src/features/coach/api/coach.ts
import { API_URL } from "@/shared/config";
import type { CoachPrefs } from "@/features/coach/types/prefsTypes";

/** ---- BE payload (nový kontrakt) -------------------------------------- */

export type AnalyzePayloadBE = {
  schema_version: number;

  goal: {
    goal_kind?: CoachPrefs["goal_kind"];
    horizon_weeks?: number;
    /** Od kedy plánovať (ISO, YYYY-MM-DD) */
    start_date?: string;
  };

  voice: {
    coach_voice?: CoachPrefs["coach_voice"];
    coach_tone?: CoachPrefs["coach_tone"];
  };

  sports: {
    main_sport?: CoachPrefs["main_sport"];
    secondary_mix?: NonNullable<CoachPrefs["secondary_mix"]>;
  };

  targets?: CoachPrefs["targets"];
  rules?: CoachPrefs["preferences"];

  externals?: CoachPrefs["external_activities"];
  injuries?: CoachPrefs["injuries"];

  focus?: {
    areas?: string[];
    avoid_zones?: string[];
    rehab?: CoachPrefs["rehab_focus"];
  };

  intensity_model?: "polarized" | "pyramidal" | null;
  blocks?: {
    vo2max?: boolean;
    threshold?: boolean;
    ftp?: boolean;
  };

  /** Kompat: ak BE ešte číta aj toto pole mimo goal */
  plan_start_date?: string | null;

  strength_settings?: CoachPrefs["strength_settings"];

  legacy?: {
    distance?: CoachPrefs["distance"];
    current_pace?: CoachPrefs["current_pace"];
    target_pace?: CoachPrefs["target_pace"];
  };

  /** Voliteľné – umožníš FE prepnúť model (napr. "gpt-5" alebo "gpt-4o-mini") */
  explicit_model?: string | null;
};

export function toAnalyzePayloadBE(prefs: Partial<CoachPrefs>): AnalyzePayloadBE {
  const intensity_model =
    prefs.polarized_model ? "polarized" :
    prefs.pyramidal_model ? "pyramidal" :
    null;

  const secondary = (prefs.secondary_mix ?? []).filter(
    (x) => (x?.share_pct ?? 0) > 0
  );

  return {
    schema_version: 2,

    goal: {
      goal_kind: prefs.goal_kind,
      horizon_weeks: prefs.weeks ?? undefined,
      // správne mapovanie – preferuj plan_start_date z prefs
      start_date: (prefs as any).plan_start_date ?? (prefs as any).start_date ?? undefined,
    },

    voice: {
      coach_voice: prefs.coach_voice,
      coach_tone: prefs.coach_tone,
    },

    sports: {
      main_sport: prefs.main_sport,
      secondary_mix: secondary,
    },

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

    // ⚠️ FIX: predtým tu bola chyba (distance). Teraz posielame správny dátum.
    plan_start_date: (prefs as any).plan_start_date ?? (prefs as any).start_date ?? null,

    strength_settings: prefs.strength_settings ?? undefined,

    legacy: {
      distance: prefs.distance ?? undefined,
      current_pace: prefs.current_pace ?? undefined,
      target_pace: prefs.target_pace ?? undefined,
    },

    // optional – FE môže doplniť pri volaní analyzeCoach (ak chceš)
    explicit_model: null,
  };
}

/** ---- API calls -------------------------------------------------------- */

export async function analyzeCoach(
  userId: number,
  prefsOrPayload: Partial<CoachPrefs> | AnalyzePayloadBE
) {
  const payload: AnalyzePayloadBE =
    "schema_version" in (prefsOrPayload as any)
      ? (prefsOrPayload as AnalyzePayloadBE)
      : toAnalyzePayloadBE(prefsOrPayload as Partial<CoachPrefs>);

  const res = await fetch(`${API_URL}/coach/analyze/${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(payload),
  });

  let json: any = null;
  try { json = await res.json(); } catch { /* ignore */ }

  if (!res.ok || !json?.success) {
    const msg = json?.detail || json?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

export async function sendCoachFeedback(userId: number, body: unknown) {
  const res = await fetch(`${API_URL}/coach/feedback/${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(body ?? {}),
  });

  let json: any = null;
  try { json = await res.json(); } catch { /* ignore */ }

  if (!res.ok || !json?.success) {
    throw new Error(json?.detail || `HTTP ${res.status}`);
  }
  return json;
}