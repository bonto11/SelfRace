import { fetchAllPrefs, PrefKey, UserPrefRow, setPref } from "@/shared/api/userPrefs";

const LS_PREFIX = "up:"; // user preferences
const VERSION = "v1";    // bump, ak meníš formát

export function getPrefLS<T = any>(userId: number, key: PrefKey): T | undefined {
  const raw = localStorage.getItem(`${LS_PREFIX}${userId}:${key}:${VERSION}`);
  if (!raw) return undefined;
  try { return JSON.parse(raw) as T; } catch { return undefined; }
}

export function setPrefLS(userId: number, key: PrefKey, value: any) {
  localStorage.setItem(`${LS_PREFIX}${userId}:${key}:${VERSION}`, JSON.stringify(value));
}

export async function bootstrapUserPrefs(userId: number): Promise<Record<string, any>> {
  // ak máš aspoň 1 kľúč v LS pre usera, nerieš – číta sa zo storage
  const hasAny = Object.keys(localStorage).some(k => k.startsWith(`${LS_PREFIX}${userId}:`));
  if (hasAny) return readAllFromLS(userId);

  // inak stiahni všetko z DB a ulož do LS
  const rows = await fetchAllPrefs(userId);
  rows.forEach((r: UserPrefRow) => setPrefLS(userId, r.key as PrefKey, r.value));
  return readAllFromLS(userId);
}

export function readAllFromLS(userId: number): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k in localStorage) {
    if (!k.startsWith(`${LS_PREFIX}${userId}:`)) continue;
    const [, , key] = k.split(":"); // up:{user}:{key}:{VERSION}
    try { out[key] = JSON.parse(localStorage.getItem(k) || "null"); } catch {}
  }
  return out;
}

// helper na jednotné sety – uloží do LS aj na BE
export async function savePref(userId: number, key: PrefKey, value: any) {
  setPrefLS(userId, key, value);
  await setPref(userId, key, value);
}