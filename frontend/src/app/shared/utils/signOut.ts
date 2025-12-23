"use client";

/**
 * Odhlásenie z FE:
 * 1) požiada server o zrušenie httpOnly cookies (/api/auth/set-session)
 * 2) vyčistí local/sessionStorage, non-httpOnly cookies, Cache Storage
 * 3) pošle broadcast do iných tabov
 * 4) presmeruje
 */
export async function signOut(redirectTo: string = "/signin") {
  try {
    await fetch("/api/auth/set-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify({ event: "SIGNED_OUT" }),
    });
  } catch {}

  // client cleanup
  try { localStorage.clear(); } catch {}
  try { sessionStorage.clear(); } catch {}

  try {
    document.cookie.split(";").forEach((c) => {
      const [name] = c.split("="); if (!name) return;
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

  if (typeof window !== "undefined") window.location.replace(redirectTo);
}