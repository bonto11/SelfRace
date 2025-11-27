// src/features/coach/api/coach.ts
import { API_URL } from "@/shared/config";
import type { CoachPrefs } from "@/features/coach/types/prefsTypes";

/* ====================== Types ====================== */

export type ZonesPayload = {
  hr_max?: number | null;
  z1_min?: number | null; z1_max?: number | null;
  z2_min?: number | null; z2_max?: number | null;
  z3_min?: number | null; z3_max?: number | null;
  z4_min?: number | null; z4_max?: number | null;
  z5_min?: number | null; z5_max?: number | null;
};

export type ThresholdsPayload = {
  sport?: string | null;
  hr_bpm?: number | null;            // LTHR – normalized (HR_bpm -> hr_bpm)
  pace_sec_km?: number | null;
  power_watt?: number | null;
  threshold_type?: string | null;
  measurement_type?: string | null;
  updated_at?: string | null;
};

export type AnalyzePayloadBE = {
  schema_version: number;

  // plan/meta
  weeks?: number;
  goal_kind?: CoachPrefs["goal_kind"];
  plan_start_date?: string | null;

  // sports & prefs
  primary_sports?: string[];
  main_sport?: CoachPrefs["main_sport"];
  secondary_mix?: NonNullable<CoachPrefs["secondary_mix"]>;
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
  blocks?: { vo2max?: boolean; threshold?: boolean; ftp?: boolean };
  strength_settings?: CoachPrefs["strength_settings"];

  // voice (optional)
  coach_voice?: CoachPrefs["coach_voice"];
  coach_tone?: CoachPrefs["coach_tone"];

  // NEW
  zones?: ZonesPayload;
  thresholds?: ThresholdsPayload;

  // legacy (optional)
  legacy?: {
    distance?: CoachPrefs["distance"];
    current_pace?: CoachPrefs["current_pace"];
    target_pace?: CoachPrefs["target_pace"];
  };

  // optionals added by actions later
  goal_structured?: Partial<CoachPrefs>;
  bests?: any;
};

/* ====================== Mappers ====================== */

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
    hr_bpm: (t.hr_bpm ?? t.HR_bpm) ?? null, // normalize case
    pace_sec_km: t.pace_sec_km ?? null,
    power_watt: t.power_watt ?? null,
    threshold_type: t.threshold_type ?? null,
    measurement_type: t.measurement_type ?? null,
    updated_at: t.updated_at ?? null,
  };
}

/* ====================== API calls ====================== */

type AnalyzeOptions = {
  debugRaw?: boolean;      // adds ?debug_raw=1
  loose?: boolean;         // adds ?loose=1 (kept for future)
  explicitModel?: string;  // override model via header
};

async function robustJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await res.json();
  const text = await res.text().catch(() => "");
  return { success: false, detail: text || `HTTP ${res.status}` };
}


/* ====================== Payload builder ====================== */

export function apiToAnalyzePayloadBE(prefs: Partial<CoachPrefs>): AnalyzePayloadBE {
  // defaultuj model, ak nie je zvolený žiadny → polarized
  const rawModel =
    prefs.polarized_model ? "polarized" :
    prefs.pyramidal_model ? "pyramidal" :
    null;

  const intensity_model = (rawModel ?? "polarized") as "polarized" | "pyramidal";

  const secondary = (prefs.secondary_mix ?? []).filter((x) => (x?.share_pct ?? 0) > 0);
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
    plan_start_date: (prefs as any).plan_start_date ?? (prefs as any).start_date ?? null,

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

export async function apiAnalyzeCoach(
  userId: number,
  prefsOrPayload: Partial<CoachPrefs> | AnalyzePayloadBE,
  opts: AnalyzeOptions = {}
) {
  const basePayload: AnalyzePayloadBE =
    "schema_version" in (prefsOrPayload as any)
      ? (prefsOrPayload as AnalyzePayloadBE)
      : apiToAnalyzePayloadBE(prefsOrPayload as Partial<CoachPrefs>);

  const params = new URLSearchParams();
  if (opts.debugRaw) params.set("debug_raw", "1");
  if (opts.loose)    params.set("loose", "1");

  const url = `${API_URL}/coach/analyze/${userId}${params.toString() ? `?${params}` : ""}`;
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (opts.explicitModel) headers["X-Model"] = opts.explicitModel;

  const res = await fetch(url, {
    method: "POST",
    headers,
    cache: "no-store",
    body: JSON.stringify(basePayload),
  }).catch((e) => { throw new Error(`Network/CORS: ${String(e)}`); });

  const json = await robustJson(res);
  if (!res.ok || !json?.success) {
    const msg = json?.detail || json?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

export async function apiSendCoachFeedback(userId: number, body: unknown) {
  const res = await fetch(`${API_URL}/coach/feedback/${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(body ?? {}),
  }).catch((e) => { throw new Error(`Network/CORS: ${String(e)}`); });

  const json = await robustJson(res);
  if (!res.ok || !json?.success) throw new Error(json?.detail || `HTTP ${res.status}`);
  return json;
}