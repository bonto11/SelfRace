// src/features/coach/api/prefs.ts
import { callBackend } from "@/app/shared/utils/callBackend";

// kľúč pre coach prefs
const KEY = "coach.prefs";

type AnyJson = any;

/**
 * Rozbalí rôzne tvary:
 * - { value: {...} }
 * - { value: { value: {...} } }
 * - { pref: { value: {...} } }
 * - { prefs: {...} }
 */
function extractValue<T = AnyJson>(j: unknown): T | null {
  const any = j as AnyJson;

  // 1. prvý level
  let v: AnyJson =
    any?.value ?? any?.pref?.value ?? any?.prefs ?? any?.pref ?? null;

  // 2. ak je tam ešte zanořené "value", rozbaľ aj to
  if (v && typeof v === "object" && "value" in v) {
    v = (v as AnyJson).value ?? v;
  }

  return (v ?? null) as T | null;
}

export async function apiGetCoachPrefs<T = AnyJson>(
  userId: number
): Promise<T | null> {
  if (!userId) return null;

  const path = `/users/${encodeURIComponent(
    String(userId)
  )}/prefs/${encodeURIComponent(KEY)}`;
  console.debug("[COACH][prefs][GET] ->", path);

  try {
    const json = await callBackend<any>(path, {
      method: "GET",
      cache: "no-store",
    });

    const val = extractValue<T>(json);
    // debug ak treba:
    // console.log("[COACH][prefs] raw:", json);
    // console.log("[COACH][prefs] extracted:", val);
    return val;
  } catch (e) {
    console.error("[COACH][prefs][GET] error", e);
    return null;
  }
}

export async function apiSaveCoachPrefs<T = AnyJson>(
  userId: number,
  value: T
): Promise<void> {
  if (!userId) throw new Error("Missing userId for apiSaveCoachPrefs");

  const path = `/users/${encodeURIComponent(
    String(userId)
  )}/prefs/${encodeURIComponent(KEY)}`;
  console.debug("[COACH][prefs][PUT] ->", path);

  await callBackend<any>(path, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ value }),
  }).catch((e) => {
    console.error("[COACH][prefs][PUT] error", e);
    throw e;
  });
}