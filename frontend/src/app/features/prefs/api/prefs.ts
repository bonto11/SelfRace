// src/shared/api/userPrefs.ts

import { callBackend } from "@/app/shared/utils/callBackend";

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