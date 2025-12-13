import { cookies } from "next/headers";

const COOKIE_NAME = "sr_uidn";

/** Pre server komponenty: rýchlo načítaj interné userId z HttpOnly cookie. */
export function apiGetAppUserIdFromCookies(): number | null {
  const c = cookies().get(COOKIE_NAME)?.value ?? null;
  if (!c) return null;
  const n = Number(c);
  return Number.isFinite(n) ? n : null;
}
