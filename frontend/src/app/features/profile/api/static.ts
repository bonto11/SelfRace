// src/features/profile/api/static.ts

import { callBackend } from "@/app/shared/utils/callBackend";
import type {
  StaticProfile,
  StaticProfileSuccess,
  StaticApiFail,
} from "@/app/features/profile/types/profile";

/**
 * GET /profile/static/:user_id
 * - user sa identifikuje cez JWT + path user_id
 */
export async function apiGetStaticProfile(
  userId: number
): Promise<StaticProfile | null> {
  if (!userId) return null;

  const path = `/profile/static/${encodeURIComponent(String(userId))}`;
  console.debug("[PROFILE][apiGetStaticProfile] ->", path);

  try {
    const json = await callBackend<StaticProfileSuccess | StaticApiFail | null>(
      path,
      {
        method: "GET",
        cache: "no-store",
      }
    );

    if (!json || (json as StaticApiFail).success === false) {
      return null;
    }

    return (json as StaticProfileSuccess).data ?? null;
  } catch (e) {
    console.error("[PROFILE][apiGetStaticProfile] ERROR", e);
    return null;
  }
}

/**
 * POST /profile/static/:user_id
 * - telo = čisté StaticProfile
 * - user_uid už neposielame, BE si usera nájde z JWT
 */
export async function apiSaveStaticProfile(
  userId: number,
  data: StaticProfile
): Promise<StaticProfile> {
  if (!userId) {
    throw new Error("Missing userId in apiSaveStaticProfile");
  }

  const path = `/profile/static/${encodeURIComponent(String(userId))}`;
  console.debug("[PROFILE][apiSaveStaticProfile] ->", path, "payload:", data);

  try {
    const json = await callBackend<StaticProfileSuccess | StaticApiFail | null>(
      path,
      {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );

    if (!json || (json as StaticApiFail).success === false) {
      const msg =
        (json as StaticApiFail)?.detail ||
        "[PROFILE] apiSaveStaticProfile failed";
      throw new Error(msg);
    }

    return (json as StaticProfileSuccess).data;
  } catch (e) {
    console.error("[PROFILE][apiSaveStaticProfile] ERROR", e);
    throw e;
  }
}