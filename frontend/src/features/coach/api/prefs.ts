// src/features/coach/api/prefs.ts
import { API_URL } from "@/shared/config";

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
    any?.value ??
    any?.pref?.value ??
    any?.prefs ??
    any?.pref ??
    null;

  // 2. ak je tam ešte zanořené "value", rozbaľ aj to
  if (v && typeof v === "object" && "value" in v) {
    v = (v as AnyJson).value ?? v;
  }

  return (v ?? null) as T | null;
}

export async function apiGetCoachPrefs<T = AnyJson>(
  userId: number,
): Promise<T | null> {
  try {
    const url = `${API_URL}/users/${userId}/prefs/${encodeURIComponent(KEY)}`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;

    const j = await r.json().catch(() => ({}));
    const val = extractValue<T>(j);
    // na debug:
    // console.log("userPrefs raw:", j);
    // console.log("userPrefs extracted:", val);
    return val;
  } catch {
    return null;
  }
}

export async function apiSaveCoachPrefs<T = AnyJson>(
  userId: number,
  value: T
): Promise<void> {
  const url = `${API_URL}/users/${userId}/prefs/${encodeURIComponent(KEY)}`;
  await fetch(url, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ value }),
  });
}