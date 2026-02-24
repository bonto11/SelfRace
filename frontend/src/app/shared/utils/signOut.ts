// src/app/shared/utils/signOut.ts
"use client";

import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";

export async function signOut(redirectTo: string = "/") {
  try {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
  } catch (e) {
    console.warn("[signOut] error:", e);
  }

  try {
    const LS_PREFIXES = ["sb-", "up:", "coach.", "selfrace:", "selfrace_"];
    if (typeof window !== "undefined") {
      const keys = Object.keys(window.localStorage);
      for (const key of keys) {
        if (LS_PREFIXES.some((p) => key.startsWith(p))) {
          window.localStorage.removeItem(key);
        }
      }
      window.localStorage.setItem("up:logout_at", String(Date.now()));
      window.sessionStorage.clear();
    }
  } catch (e) {
    console.warn("[signOut] storage cleanup failed:", e);
  }

  // Odstránime aj cookies pre istotu, ak by tam nejaké zostali z predchádzajúcich testov
  try {
    if (typeof document !== "undefined") {
      const cookies = document.cookie.split(";");
      for (let i = 0; i < cookies.length; i++) {
        const name = cookies[i].trim().split("=")[0];
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
      }
    }
  } catch (e) {}

  if (typeof window !== "undefined") {
    window.location.replace(redirectTo);
  }
}