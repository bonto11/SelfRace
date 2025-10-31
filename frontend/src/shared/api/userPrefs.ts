import { API_URL } from "@/shared/config";

export type PrefKey =
  | "ui.favorite_pb_run_m"
  | "coach.goal_kind"
  | "coach.weeks"
  | "coach.days_off"
  | "coach.long_run_days"
  | "coach.avoid_back_to_back_hard"
  | "coach.use_zones"
  | "coach.wu_cd_detail"
  | "coach.primary_sports"
  | (string & {}); // pre budúce kľúče

export type UserPrefRow = { key: string; value: any; updated_at: string };

export async function fetchAllPrefs(userId: number): Promise<UserPrefRow[]> {
  const r = await fetch(`${API_URL}/users/${userId}/prefs`, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.detail ?? `prefs load failed: ${r.status}`);
  return j?.prefs ?? [];
}

export async function fetchPref(userId: number, key: PrefKey): Promise<UserPrefRow | null> {
  const r = await fetch(`${API_URL}/users/${userId}/prefs/${encodeURIComponent(key)}`, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.detail ?? `pref load failed: ${r.status}`);
  return j?.pref ?? null;
}

export async function setPref(userId: number, key: PrefKey, value: any): Promise<void> {
  const r = await fetch(`${API_URL}/users/${userId}/prefs/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.detail ?? `pref save failed: ${r.status}`);
}

export async function setManyPrefs(userId: number, kv: Record<PrefKey, any>): Promise<void> {
  const r = await fetch(`${API_URL}/users/${userId}/prefs`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(kv),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.detail ?? `prefs save failed: ${r.status}`);
}

export async function deletePref(userId: number, key: PrefKey): Promise<void> {
  const r = await fetch(`${API_URL}/users/${userId}/prefs/${encodeURIComponent(key)}`, { method: "DELETE" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.detail ?? `pref delete failed: ${r.status}`);
}