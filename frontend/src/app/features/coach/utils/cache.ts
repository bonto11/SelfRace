// src/features/coach/utils/cache.ts
"use client";

// Jednoduchá DEV cache do localStorage s verziovaním podľa userId + prefs hash.

type Cached = {
  savedAt: string; // ISO
  key: string; // cache kľúč (userId:prefsHash)
  model?: string;
  result: any;
};

const NS = "coach_result";

/* --- stable stringify + simple hash --- */

function stableStringify(obj: any): string {
  const seen = new WeakSet();
  const walk = (x: any): any => {
    if (x && typeof x === "object") {
      if (seen.has(x)) return null;
      seen.add(x);
      if (Array.isArray(x)) return x.map(walk);
      const out: any = {};
      for (const k of Object.keys(x).sort()) out[k] = walk(x[k]);
      return out;
    }
    return x;
  };
  return JSON.stringify(walk(obj));
}

function djb2(str: string) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36);
}

/**
 * Z prefs vyber len to, čo ovplyvňuje plán a urob z toho hash.
 * - držíme sa novej štruktúry: intensity + blocks sú v preferences.*
 * - external events sú jediné “pevné” mimo prefs/rules (ak ich stále nesieš v prefs, zahrň ich)
 * - žiadne staré top-level polarized_model/pyramidal_model ani top-level block toggles
 */
export function makeCacheKey(userId: string, prefs: any) {
  const p = prefs && typeof prefs === "object" ? prefs : {};
  const pr = (p.preferences && typeof p.preferences === "object") ? p.preferences : {};

  // NEW: intensity model + blocks inside preferences
  const intensity_model =
    pr.intensity_model === "pyramidal" ? "pyramidal" : "polarized";

  const b = pr.training_blocks;
  const training_blocks =
    b && typeof b === "object"
      ? { vo2max: !!b.vo2max, ftp: !!b.ftp, threshold: !!b.threshold }
      : { vo2max: false, ftp: false, threshold: false };

  // External events: nechávam ako "externals", ale:
  // - preferuj nový field ak existuje (napr. external_events)
  // - fallback na starý external_activities, ak ešte niekde žije
  const externals =
    (Array.isArray(p.external_events) ? p.external_events : null) ??
    (Array.isArray(p.external_activities) ? p.external_activities : []);

  const core = {
    // bump version when key logic changes
    sv: 3,

    // plan fundamentals
    goal_kind: p.goal_kind ?? null,
    weeks: p.weeks ?? null,
    start_date: p.start_date ?? null,
    end_date: p.end_date ?? null,

    // sports
    main_sport: p.main_sport ?? null,
    add_on_sports: Array.isArray(p.add_on_sports) ? p.add_on_sports : [],
    secondary_mix: Array.isArray(p.secondary_mix)
      ? p.secondary_mix.map((x: any) => ({
          sport: x?.sport ?? null,
          role: x?.role ?? null,
          pct: Number(x?.share_pct) || 0,
        }))
      : [],

    // targets & volume & strength settings
    volume: p.volume ?? null,
    targets: p.targets ?? null,
    strength_settings: p.strength_settings ?? null,

    // rules/preferences (includes intensity + blocks)
    preferences: {
      ...pr,

      // enforce canonical bits for stable hash
      intensity_model,
      training_blocks,
    },

    // externals + health context
    externals,
    injuries: Array.isArray(p.injuries) ? p.injuries : [],

    // focus/avoid/rehab knobs (ak existujú)
    focus: {
      areas: Array.isArray(p.focus_areas) ? p.focus_areas : [],
      avoid: Array.isArray(p.avoid_zones) ? p.avoid_zones : [],
      rehab: p.rehab_focus ?? null,
    },

    // coach voice/tone (ak existuje)
    voice: p.coach_voice ?? null,
    tone: p.coach_tone ?? null,
  };

  const raw = stableStringify(core);
  const hash = djb2(raw);
  return `${NS}:${userId}:${hash}`;
}

export function loadCachedResult(key?: string): Cached | null {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Cached) : null;
  } catch {
    return null;
  }
}

export function saveCachedResult(key: string, data: any, model?: string) {
  try {
    const payload: Cached = {
      savedAt: new Date().toISOString(),
      key,
      model,
      result: data,
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function clearCachedByKey(key?: string) {
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}