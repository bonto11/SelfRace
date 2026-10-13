// src/app/auth/google/oauth.ts – spoločné pre /auth/google a jeho callback

export const GOOGLE_STATE_COOKIE = "sr_g_state";

/** Musí byť presne v Google Cloud → Authorized redirect URIs (aj www). */
export function googleRedirectUri(origin: string) {
  return `${origin}/auth/google/callback`;
}
