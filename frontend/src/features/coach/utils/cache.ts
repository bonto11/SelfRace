// src/features/coach/utils/cache.ts

// Jednoduchá DEV cache do localStorage s verziovaním podľa userId + prefs hash.

type Cached = {
  savedAt: string; // ISO
  key: string;     // cache kľúč (userId:prefsHash)
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
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) + str.charCodeAt(i);
  return (h >>> 0).toString(36);
}

/** Z prefs vyber len to, čo ovplyvňuje plán, a urob z toho hash. */
export function makeCacheKey(userId: string, prefs: any) {
  const core = {
    sv: 2,
    goal_kind: prefs?.goal_kind ?? null,
    weeks: prefs?.weeks ?? null,

    main_sport: prefs?.main_sport ?? null,
    secondary_mix: (prefs?.secondary_mix ?? []).map((x: any) => ({
      sport: x?.sport,
      role: x?.role,
      pct: x?.share_pct,
    })),

    targets: prefs?.targets ?? null,
    rules: prefs?.preferences ?? null,

    externals: prefs?.external_activities ?? [],
    injuries: prefs?.injuries ?? [],

    focus: {
      areas: prefs?.focus_areas ?? [],
      avoid: prefs?.avoid_zones ?? [],
      rehab: prefs?.rehab_focus ?? null,
    },

    intensity_model: prefs?.polarized_model
      ? "polarized"
      : prefs?.pyramidal_model
      ? "pyramidal"
      : null,

    blocks: {
      vo2: !!prefs?.vo2max_training,
      thr: !!prefs?.threshold_focus,
      ftp: !!prefs?.ftp_training,
    },

    voice: prefs?.coach_voice ?? null,
    tone: prefs?.coach_tone ?? null,
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