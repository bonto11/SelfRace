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
    throw new Error("api.prefs.loadFailed");
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

    if (json?.pref && "value" in json.pref) return json.pref.value;
    if (typeof json?.value !== "undefined") return json.value;
    return null;
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

  const nextStart = isoTodayPlus(1);
  const updated: CoachPrefs = { ...(prefs as any), start_date: nextStart };

  try {
    await apiUpsertUserPref(userId, "coach.prefs", updated);
  } catch (e) {
    console.error("[CoachPrefs][ensurePlanStartFuture] upsert error", e);
  }

  return updated;
}

export async function apiSavePushSubscription(userId: number, subscription: any) {
  return callBackend(`/users/${userId}/push-subscription`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  });
}