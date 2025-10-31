// src/shared/utils/signOut.ts
export async function signOut(redirectTo: string = "/signin") {
  // 1) server – zmaže httpOnly cookies + Clear-Site-Data
  try { await fetch("/api/auth/signout", { method: "POST", cache: "no-store" }); } catch {}

  // 2) klient – “best effort” dočistenie
  try { localStorage.clear(); } catch {}
  try { sessionStorage.clear(); } catch {}

  // zmaž všetky dostupné (non-httpOnly) cookies
  try {
    document.cookie.split(";").forEach(c => {
      const [name] = c.split("="); if (!name) return;
      document.cookie = `${name.trim()}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    });
  } catch {}

  // cache API (ak je)
  try {
    if ("caches" in self) {
      const names = await caches.keys();
      await Promise.all(names.map(n => caches.delete(n)));
    }
  } catch {}

  // cross-tab broadcast (voliteľné: iné taby môžu reagovať)
  try { localStorage.setItem("up:logout_at", String(Date.now())); } catch {}

  // 3) presmeruj
  if (typeof window !== "undefined") window.location.replace(redirectTo);
}