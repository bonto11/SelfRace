// Jednoduchá DEV cache do localStorage s verziovaním podľa userId + prefs hash.

type Cached = {
  savedAt: string;   // ISO
  key: string;       // cache kľúč (userId:prefsHash)
  model?: string;
  result: any;
};

const NS = "coach_result";

function djb2(str: string) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) + str.charCodeAt(i);
  return (h >>> 0).toString(36);
}

export function makeCacheKey(userId: string, prefs: any) {
  const raw = JSON.stringify(prefs ?? {});
  const hash = djb2(raw);
  return `${NS}:${userId}:${hash}`;
}

export function loadCachedResult(key?: string): Cached | null {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as Cached : null;
  } catch { return null; }
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
  } catch {}
}

export function clearCachedByKey(key?: string) {
  if (!key) return;
  try { localStorage.removeItem(key); } catch {}
}