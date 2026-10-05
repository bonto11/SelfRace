// src/features/prefs/api/prefs.ts
import { callBackend, onBackendMutation } from "@/app/shared/utils/callBackend";
import type { CoachPrefs } from "@/app/features/prefs/types/prefs";

export type UserPrefRow = { key: string; value: any };

/*
 * Krátka spoločná cache pre GET všetkých prefs.
 *
 * PREČO: pri štarte appky si prefs ťahalo ~8 komponentov naraz (bootstrapper
 * všetky, potom coach provider, onboarding, push/PWA banner, nastavenia,
 * widgety každý svoj kľúč zvlášť). Teraz sa všetky jednotlivé čítania
 * pripoja na jeden bulk request. TTL je zámerne krátke - BE vie prefs
 * meniť sám (napr. pri štarte plánu) a refresh po takej akcii musí
 * dostať čerstvé dáta. Každý zápis cache zahodí.
 */
const BULK_TTL_MS = 4000;

type BulkEntry = {
  userId: number;
  promise: Promise<Record<string, any>>;
  doneAt: number | null;
};

let bulk: BulkEntry | null = null;

function invalidatePrefsCache() {
  bulk = null;
}

onBackendMutation(invalidatePrefsCache);

async function fetchAllPrefs(userId: number): Promise<Record<string, any>> {
  const path = `/prefs/${encodeURIComponent(String(userId))}`;
  const json = await callBackend<{ prefs?: UserPrefRow[]; detail?: string }>(
    path,
    {
      method: "GET",
      cache: "no-store",
    }
  );

  const rows: UserPrefRow[] = Array.isArray(json?.prefs) ? json.prefs : [];
  const out: Record<string, any> = {};
  for (const row of rows) {
    out[row.key] = row.value;
  }
  return out;
}

function loadAllPrefsShared(userId: number): Promise<Record<string, any>> {
  const now = Date.now();
  if (
    bulk &&
    bulk.userId === userId &&
    (bulk.doneAt == null || now - bulk.doneAt < BULK_TTL_MS)
  ) {
    return bulk.promise;
  }

  const entry: BulkEntry = { userId, promise: fetchAllPrefs(userId), doneAt: null };
  bulk = entry;
  entry.promise.then(
    () => {
      entry.doneAt = Date.now();
    },
    () => {
      if (bulk === entry) bulk = null;
    }
  );
  return entry.promise;
}

export async function apiFetchUserPrefs(
  userId: number,
  prefix?: string
): Promise<Record<string, any>> {
  if (!userId) return {};

  try {
    const all = await loadAllPrefsShared(userId);
    if (!prefix) return { ...all };

    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(all)) {
      if (k.startsWith(prefix)) out[k] = v;
    }
    return out;
  } catch (e: any) {
    console.error("[UserPrefs][apiFetchUserPrefs] ERROR", e);
    throw new Error("api.prefs.loadFailed");
  }
}

export async function apiFetchUserPref(
  userId: number,
  key: string
): Promise<any | null> {
  if (!userId || !key) return null;

  try {
    const all = await loadAllPrefsShared(userId);
    return key in all ? all[key] : null;
  } catch (e: any) {
    console.error("[UserPrefs][apiFetchUserPref] ERROR", e);
    throw new Error("api.prefs.loadFailed");
  }
}

export async function apiUpsertUserPref(
  userId: number,
  key: string,
  value: any
): Promise<void> {
  if (!userId || !key) {
    throw new Error("api.common.missingUserAuth");
  }

  const path = `/prefs/${encodeURIComponent(
    String(userId)
  )}/key/${encodeURIComponent(key)}`;

  try {
    await callBackend<any>(path, {
      method: "PUT",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(value),
    });
    invalidatePrefsCache();
  } catch (e: any) {
    console.error("[UserPrefs][apiUpsertUserPref] ERROR", e);
    throw new Error("api.prefs.saveFailed");
  }
}

export async function apiUpsertUserPrefs(
  userId: number,
  rows: UserPrefRow[]
): Promise<void> {
  if (!userId) {
    throw new Error("api.common.missingUserAuth");
  }

  const path = `/prefs/${encodeURIComponent(String(userId))}`;

  try {
    await callBackend<any>(path, {
      method: "PUT",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prefs: rows }),
    });
    invalidatePrefsCache();
  } catch (e: any) {
    console.error("[UserPrefs][apiUpsertUserPrefs] ERROR", e);
    throw new Error("api.prefs.saveFailed");
  }
}

/* ───────────────────── helper pre coach plan start ───────────────────── */

function isoToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoTodayPlus(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function apiEnsureCoachPlanStartFuture(
  userId: number
): Promise<CoachPrefs | null> {
  if (!userId) return null;

  let prefs: CoachPrefs | null = null;

  try {
    prefs = (await apiFetchUserPref(
      userId,
      "coach.prefs"
    )) as CoachPrefs | null;
  } catch (e) {
    console.warn("[CoachPrefs][ensurePlanStartFuture] fetch error", e);
    return null;
  }

  if (!prefs || typeof prefs !== "object") return prefs;

  const current = (prefs as any).start_date as string | null | undefined;
  if (!current) return prefs;

  const today = isoToday();

  if (current >= today) return prefs;

  const nextStart = isoTodayPlus(0);
  const updated: CoachPrefs = { ...(prefs as any), start_date: nextStart };

  try {
    await apiUpsertUserPref(userId, "coach.prefs", updated);
  } catch (e) {
    console.error("[CoachPrefs][ensurePlanStartFuture] upsert error", e);
  }

  return updated;
}