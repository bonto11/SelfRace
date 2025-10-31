//src/shared/api/userPrefs
import { API_URL } from "@/shared/config";

export type UserPrefRow = { key: string; value: any };

export async function fetchUserPrefs(userId: number, prefix?: string): Promise<Record<string, any>> {
  const url = new URL(`${API_URL}/users/${userId}/prefs`);
  if (prefix) url.searchParams.set("prefix", prefix);
  const r = await fetch(url.toString(), { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.detail ?? `prefs load failed: ${r.status}`);
  const rows: UserPrefRow[] = j?.prefs ?? [];
  const out: Record<string, any> = {};
  for (const row of rows) out[row.key] = row.value;
  return out;
}

export async function fetchUserPref(userId: number, key: string): Promise<any | null> {
  const r = await fetch(`${API_URL}/users/${userId}/prefs/${encodeURIComponent(key)}`, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.detail ?? `pref load failed: ${r.status}`);
  return j?.pref?.value ?? null;
}

export async function upsertUserPref(userId: number, key: string, value: any): Promise<void> {
  const r = await fetch(`${API_URL}/users/${userId}/prefs/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.detail ?? `pref save failed: ${r.status}`);
}

export async function upsertUserPrefs(userId: number, rows: UserPrefRow[]): Promise<void> {
  const r = await fetch(`${API_URL}/users/${userId}/prefs`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prefs: rows }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.detail ?? `prefs save failed: ${r.status}`);
}