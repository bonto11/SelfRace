// src/features/coach/api/coach.ts
import { API_URL } from "@/shared/config";
import type { CoachPrefs } from "@/features/coach/types/prefsTypes";

/** ---- BE payload (nový, zjednotený kontrakt) --------------------------- */
export type AnalyzePayloadBE = {
  schema_version: number;
  // hlavné parametre plánu
  weeks?: number;
  goal_kind?: CoachPrefs["goal_kind"];
  plan_start_date?: string | null;

  // športy a nastavenia
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

  // “voice” – len pre generovanie naratívov (BE môže ignorovať)
  coach_voice?: CoachPrefs["coach_voice"];
  coach_tone?: CoachPrefs["coach_tone"];

  // legacy info (aby sa nič nestratilo, keď to ešte niekde používaš)
  legacy?: {
    distance?: CoachPrefs["distance"];
    current_pace?: CoachPrefs["current_pace"];
    target_pace?: CoachPrefs["target_pace"];
  };

  // voliteľný legacy blok – BE ho vie prečítať, ale nie je povinný
  goal_structured?: Partial<CoachPrefs>;

  // bests pridávaš až v CoachPlanActions pri volaní analyzeCoach
  bests?: any;
};

export function toAnalyzePayloadBE(prefs: Partial<CoachPrefs>): AnalyzePayloadBE {
  const intensity_model =
    prefs.polarized_model ? "polarized" :
    prefs.pyramidal_model ? "pyramidal" :
    null;

  const secondary = (prefs.secondary_mix ?? []).filter((x) => (x?.share_pct ?? 0) > 0);
  const primary: string[] = [];

  if (prefs.main_sport) {
    primary.push(prefs.main_sport);
  }
  for (const sm of secondary) {
    if (sm?.sport && !primary.includes(sm.sport)) primary.push(sm.sport);
  }
  if (primary.length === 0) {
    primary.push("run", "strength");
  }

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
    legacy: {
      distance: prefs.distance ?? undefined,
      current_pace: prefs.current_pace ?? undefined,
      target_pace: prefs.target_pace ?? undefined,
    },
    // goal_structured tu zatiaľ nepridávame – dopĺňaš ho až v CoachPlanActions
  };
}

/** ---- API calls -------------------------------------------------------- */

type AnalyzeOptions = {
  debugRaw?: boolean;      // pridá ?debug_raw=1
  loose?: boolean;         // pridá ?loose=1 (momentálne BE ignoruje, ale necháme kvôli debug)
  explicitModel?: string;  // vynúť model cez header
};

/** robustný fetch, ktorý vie zobrať aj non-JSON chybu (text/HTML) */
async function robustJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return await res.json();
  }
  const text = await res.text().catch(() => "");
  return { success: false, detail: text || `HTTP ${res.status}` };
}

export async function analyzeCoach(
  userId: number,
  prefsOrPayload: Partial<CoachPrefs> | AnalyzePayloadBE,
  opts: AnalyzeOptions = {}
) {
  const basePayload: AnalyzePayloadBE =
    "schema_version" in (prefsOrPayload as any)
      ? (prefsOrPayload as AnalyzePayloadBE)
      : toAnalyzePayloadBE(prefsOrPayload as Partial<CoachPrefs>);

  // v CoachPlanActions k nemu ešte prilepuješ goal_structured a bests
  const payload = basePayload;

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
    body: JSON.stringify(payload),
  }).catch((e) => {
    throw new Error(`Network/CORS: ${String(e)}`);
  });

  const json = await robustJson(res);

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
  }).catch((e) => {
    throw new Error(`Network/CORS: ${String(e)}`);
  });

  const json = await robustJson(res);
  if (!res.ok || !json?.success) throw new Error(json?.detail || `HTTP ${res.status}`);
  return json;
}