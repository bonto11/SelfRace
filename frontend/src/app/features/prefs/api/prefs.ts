// src/features/prefs/api/prefs.ts
import { callBackend } from "@/app/shared/utils/callBackend";
import type { CoachPrefs } from "@/app/features/prefs/types/prefs";

export type UserPrefRow = { key: string; value: any };

export async function apiFetchUserPrefs(
  userId: number,
  prefix?: string
): Promise<Record<string, any>> {
  if (!userId) return {};

  const qs = prefix ? `?prefix=${encodeURIComponent(prefix)}` : "";
  const path = `/prefs/${encodeURIComponent(String(userId))}${qs}`;
  console.debug("[UserPrefs][apiFetchUserPrefs] ->", path);

  try {
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
  } catch (e: any) {
    console.error("[UserPrefs][apiFetchUserPrefs] ERROR", e);
    const msg =
      e instanceof Error ? e.message : "prefs load failed (apiFetchUserPrefs)";
    throw new Error(msg);
  }
}

export async function apiFetchUserPref(
  userId: number,
  key: string
): Promise<any | null> {
  if (!userId || !key) return null;

  const path = `/prefs/${encodeURIComponent(
    String(userId)
  )}/key/${encodeURIComponent(key)}`;
  console.debug("[UserPrefs][apiFetchUserPref] ->", path);

  try {
    const json = await callBackend<{
      pref?: { value: any };
      key?: string;
      value?: any;
      detail?: string;
    }>(path, {
      method: "GET",
      cache: "no-store",
    });

    // podpora starého aj nového tvaru odpovede
    if (json?.pref && "value" in json.pref) return json.pref.value;
    if (typeof json?.value !== "undefined") return json.value;
    return null;
  } catch (e: any) {
    console.error("[UserPrefs][apiFetchUserPref] ERROR", e);
    const msg =
      e instanceof Error ? e.message : "pref load failed (apiFetchUserPref)";
    throw new Error(msg);
  }
}

export async function apiUpsertUserPref(
  userId: number,
  key: string,
  value: any
): Promise<void> {
  if (!userId || !key) {
    throw new Error("Missing userId or key in apiUpsertUserPref");
  }

  const path = `/prefs/${encodeURIComponent(
    String(userId)
  )}/key/${encodeURIComponent(key)}`;
  console.debug("[UserPrefs][apiUpsertUserPref] ->", path, "value:", value);

  try {
    await callBackend<any>(path, {
      method: "PUT",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(value),
    });
  } catch (e: any) {
    console.error("[UserPrefs][apiUpsertUserPref] ERROR", e);
    const msg =
      e instanceof Error ? e.message : "pref save failed (apiUpsertUserPref)";
    throw new Error(msg);
  }
}

export async function apiUpsertUserPrefs(
  userId: number,
  rows: UserPrefRow[]
): Promise<void> {
  if (!userId) {
    throw new Error("Missing userId in apiUpsertUserPrefs");
  }

  const path = `/prefs/${encodeURIComponent(String(userId))}`;
  console.debug("[UserPrefs][apiUpsertUserPrefs] ->", path, "rows:", rows);

  try {
    await callBackend<any>(path, {
      method: "PUT",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prefs: rows }),
    });
  } catch (e: any) {
    console.error("[UserPrefs][apiUpsertUserPrefs] ERROR", e);
    const msg =
      e instanceof Error ? e.message : "prefs save failed (apiUpsertUserPrefs)";
    throw new Error(msg);
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

/**
 * Ak má coach.prefs.start_date dátum v minulosti, nastaví ho na zajtra
 * (rovnaký princíp ako MIN_PLAN_START v PlanStartSection) a uloží do DB.
 * Vráti aktuálne prefs (pôvodné alebo upravené).
 */
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

  // už je dnes alebo v budúcnosti -> nič nerobíme
  if (current >= today) return prefs;

  const nextStart = isoTodayPlus(1);
  const updated: CoachPrefs = { ...(prefs as any), start_date: nextStart };

  try {
    await apiUpsertUserPref(userId, "coach.prefs", updated);
  } catch (e) {
    console.error("[CoachPrefs][ensurePlanStartFuture] upsert error", e);
    // aj keď save zlyhá, vraciame lokálne updated, nech FE vie, čo sme chceli
  }

  return updated;
}