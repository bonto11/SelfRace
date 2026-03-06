// src/features/performance/api/static.ts

import { callBackend } from "@/app/shared/utils/callBackend";
import type {
  StaticProfile,
  StaticProfileSuccess,
  StaticApiFail,
} from "@/app/features/performance/types/performance";

/**
 * GET /performance/static/:user_id
 * - user sa identifikuje cez JWT + path user_id
 */
export async function apiGetStaticProfile(
  userId: number,
): Promise<StaticProfile | null> {
  if (!userId) throw new Error("api.common.missingUserAuth");

  const path = `/profile/static/${encodeURIComponent(String(userId))}`;
  console.debug("[PROFILE][apiGetStaticProfile] ->", path);

  try {
    const json = await callBackend<StaticProfileSuccess | StaticApiFail | null>(
      path,
      {
        method: "GET",
        cache: "no-store",
      },
    );

    if (!json || (json as StaticApiFail).success === false) {
      return null;
    }

    return (json as StaticProfileSuccess).data ?? null;
  } catch (e) {
    console.error("[PROFILE][apiGetStaticProfile] ERROR", e);
    throw new Error("api.profile.staticLoadFailed");
  }
}

/**
 * POST /profile/static/:user_id
 * - telo = čisté StaticProfile
 * - user_uid už neposielame, BE si usera nájde z JWT
 */
export async function apiSaveStaticProfile(
  userId: number,
  data: StaticProfile,
): Promise<StaticProfile> {
  if (!userId) {
    throw new Error("api.common.missingUserAuth");
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
      },
    );

    if (!json || (json as StaticApiFail).success === false) {
      throw new Error("api.profile.staticSaveFailed");
    }

    return (json as StaticProfileSuccess).data;
  } catch (e) {
    console.error("[PROFILE][apiSaveStaticProfile] ERROR", e);
    throw new Error("api.profile.staticSaveFailed");
  }
}
