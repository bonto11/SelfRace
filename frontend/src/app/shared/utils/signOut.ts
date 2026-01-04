// src/app/shared/utils/signOut.ts
"use client";

/**
 * Produkčná verzia signOut:
 * 1) povie serveru SIGNED_OUT (zruší Supabase session v httpOnly cookies)
 * 2) vyčistí naše localStorage/sessionStorage kľúče a niektoré cookies
 * 3) (voliteľne) vyčistí Cache Storage pre tento origin
 * 4) redirectne na /signin (alebo custom redirectTo)
 */
export async function signOut(redirectTo: string = "/signin") {
  // 1) server – odhlásenie cez /api/auth/set-session
  try {
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

  // 2) client cleanup – localStorage
  try {
    const LS_PREFIXES = [
      "sb-selfrace-auth-token", // náš storageKey pre Supabase
      "up:",                    // tvoje user prefs / settings
      "coach.",                 // coach cache / prefs
      "selfrace:",             // prípadné ďalšie veci
    ];

    const keys = Object.keys(window.localStorage);
    for (const key of keys) {
      if (LS_PREFIXES.some((p) => key === p || key.startsWith(p))) {
        window.localStorage.removeItem(key);
      }
    }

    // marker posledného odhlásenia – môžeš použiť v iných častiach FE
    window.localStorage.setItem("up:logout_at", String(Date.now()));
  } catch (e) {
    console.warn("[signOut] localStorage cleanup failed:", e);
  }

  // 3) client cleanup – sessionStorage
  try {
    window.sessionStorage.clear();
  } catch (e) {
    console.warn("[signOut] sessionStorage.clear failed:", e);
  }

  // 4) cookies – vyčistíme len naše identifikačné
  try {
    const cookiesToClear = ["sr_id", "sr_uuid"];
    cookiesToClear.forEach((name) => {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    });
  } catch (e) {
    console.warn("[signOut] cookies cleanup failed:", e);
  }

  // 5) voliteľne Cache Storage (ak by niečo cachovalo auth-dependent odpovede)
  try {
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
  } catch (e) {
    console.warn("[signOut] caches cleanup failed:", e);
  }

  // 6) redirect na signin
  if (typeof window !== "undefined") {
    window.location.replace(redirectTo);
  }
}