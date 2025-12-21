// src/features/profile/api/static.ts

import { API_URL } from "@/shared/config";
import type {
  StaticProfile,
  StaticProfileSuccess,
  StaticApiFail,
} from "@/features/profile/types/profile";

/** GET /profile/static/:user_id */
export async function apiGetStaticProfile(
  userId: number,
  userUid?: string | null
): Promise<StaticProfile | null> {
  const qs = userUid ? `?user_uid=${encodeURIComponent(userUid)}` : "";
  const url = `${API_URL}/profile/static/${userId}${qs}`;

  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json().catch(() => null)) as
    | StaticProfileSuccess
    | StaticApiFail
    | null;

  if (!res.ok || !json || (json as StaticApiFail).success === false) {
    return null;
  }
  return (json as StaticProfileSuccess).data ?? null;
}

/** POST /profile/static/:user_id */
export async function apiSaveStaticProfile(
  userId: number,
  data: StaticProfile,
  userUid?: string | null
): Promise<StaticProfile> {
  const url = `${API_URL}/profile/static/${userId}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_uid: userUid ?? undefined, ...data }),
  });

  const json = (await res.json().catch(() => null)) as
    | StaticProfileSuccess
    | StaticApiFail
    | null;

  if (!res.ok || !json || (json as StaticApiFail).success === false) {
    const msg = (json as StaticApiFail)?.detail || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return (json as StaticProfileSuccess).data;
}
