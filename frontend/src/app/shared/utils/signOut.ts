// src/app/shared/utils/signOut.ts
"use client";

export async function signOut(redirectTo: string = "/") {
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

  try {
    const LS_PREFIXES = [
      "sb-selfrace-auth-token",
      "up:",
      "coach.",
      "selfrace:",
    ];
    const keys = Object.keys(window.localStorage);
    for (const key of keys) {
      if (LS_PREFIXES.some((p) => key === p || key.startsWith(p))) {
        window.localStorage.removeItem(key);
      }
    }
    window.localStorage.setItem("up:logout_at", String(Date.now()));
  } catch (e) {
    console.warn("[signOut] localStorage cleanup failed:", e);
  }

  try {
    window.sessionStorage.clear();
  } catch (e) {
    console.warn("[signOut] sessionStorage.clear failed:", e);
  }

  try {
    const cookiesToClear = ["sr_id", "sr_uuid"];
    cookiesToClear.forEach((name) => {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    });
  } catch (e) {
    console.warn("[signOut] cookies cleanup failed:", e);
  }

  try {
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
  } catch (e) {
    console.warn("[signOut] caches cleanup failed:", e);
  }

  if (typeof window !== "undefined") {
    window.location.replace(redirectTo); // teraz default "/"
  }
}