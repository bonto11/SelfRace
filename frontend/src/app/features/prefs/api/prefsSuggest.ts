// src/app/features/prefs/api/prefsSuggest.ts
// AI návrh nastavenia coach prefs z textu cieľa. Návrh sa neukladá –
// vybrané zmeny sa zapíšu do formulára a uložia bežnou cestou prefs.

import { callBackend } from "@/app/shared/utils/callBackend";

export type PrefsChange = {
  /** cesta v coach prefs, napr. "goal_kind", "strength_settings.sessions_per_week" */
  field: string;
  value: unknown;
  value_text: string;
  from_text: string | null;
  why: string | null;
  effect: string | null;
};

export type PrefsSuggestion = {
  reply_text: string;
  changes: PrefsChange[];
  todo: string[];
  rounds_left: number;
};

export type PrefsThreadEntry =
  | { role: "user"; text: string }
  | { role: "assistant"; reply_text: string };

type Res = { success: true; data: PrefsSuggestion } | { success: false; error_code?: string };

/** Vyhodí Error s error_code (preklad v prefsSuggest.errors.<code>). */
export async function apiSuggestPrefs(
  userId: number,
  body: { request: string; thread: PrefsThreadEntry[] },
): Promise<PrefsSuggestion> {
  const json = await callBackend<Res>(`/prefs-suggest/${encodeURIComponent(String(userId))}`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!json || json.success !== true) throw new Error((json as any)?.error_code || "ai_generation_failed");
  return json.data;
}

/** Zapíše zmeny do kópie prefs (vnorené cesty cez bodku). */
export function applyPrefsChanges<T extends Record<string, any>>(prefs: T, changes: PrefsChange[]): T {
  const next: any = { ...prefs };
  for (const c of changes) {
    const parts = c.field.split(".");
    let cur = next;
    for (let i = 0; i < parts.length - 1; i++) {
      cur[parts[i]] = { ...(cur[parts[i]] ?? {}) };
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = c.value;
  }
  return next;
}
