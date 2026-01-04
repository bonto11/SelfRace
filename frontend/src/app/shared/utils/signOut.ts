// src/app/shared/utils/signOut.ts
"use client";

/**
 * DEBUG verzia signOut:
 * - pošle na server SIGNED_OUT (zruší httpOnly cookies / api session)
 * - NEČISTÍ localStorage, sessionStorage, cookies ani Cache Storage
 * - neredirectuje (redirect zakomentovaný)
 *
 * Cieľ: zistiť, či nás odhlasuje niekto iný (refresh, iný kód, atď.)
 */
export async function signOut(redirectTo: string = "/signin") {
  try {
    console.log("[signOut] called, redirectTo =", redirectTo);

    await fetch("/api/auth/set-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify({ event: "SIGNED_OUT" }),
    });
  } catch (e) {
    console.warn("[signOut] /api/auth/set-session failed:", e);
  }

  // DEBUG: nič nečistíme, len log
  console.log("[signOut] DEBUG mode: skipping client cleanup (LS/cookies/cache)");

  /*
  // --- pôvodný client cleanup (NEPOUŽÍVAŤ v debug režime) ---

  try { localStorage.clear(); } catch {}
  try { sessionStorage.clear(); } catch {}

  try {
    document.cookie.split(";").forEach((c) => {
      const [name] = c.split("=");
      if (!name) return;
      document.cookie = `${name.trim()}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    });
  } catch {}

  try {
    if ("caches" in self) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
  } catch {}

  try { localStorage.setItem("up:logout_at", String(Date.now())); } catch {}
  */

  /*
  // Budúca "safe" verzia cleanupu – zmaž len svoje kľúče / cookies:
  const LS_PREFIXES = ["up:", "coach.", "selfrace:"];

  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (LS_PREFIXES.some((p) => key.startsWith(p))) {
        localStorage.removeItem(key);
      }
    }
  } catch {}

  try {
    const cookiesToClear = ["sr_id", "sr_uuid", "up:logout_at"];
    cookiesToClear.forEach((name) => {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    });
  } catch {}
  */

  // DEBUG: žiadny redirect
  // if (typeof window !== "undefined") window.location.replace(redirectTo);
}