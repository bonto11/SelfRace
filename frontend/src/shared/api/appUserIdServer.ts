import { cookies } from "next/headers";

/** Pre server komponenty: rýchlo načítaj interné userId z HttpOnly cookie. */
export async function apiGetAppUserIdFromCookies(): Promise<number | null> {
  const cookieStore = await cookies();
  const c = cookieStore.get("sr_uidn")?.value ?? null;
  if (!c) return null;
  const n = Number(c);
  return Number.isFinite(n) ? n : null;
}
