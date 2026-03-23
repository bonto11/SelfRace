// src/app/shared/utils/signOut.ts
"use client";

import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";

export async function signOut(redirectTo: string = "/") {
  try {
    const supabase = getSupabaseBrowser();
    // Povieme Supabase nech ukončí session na serveri a skúsi zmazať, čo sa dá
    await supabase.auth.signOut();
  } catch (e) {
    console.warn("[signOut] Supabase signOut error:", e);
  }

  // ✅ 1. MANUÁLNE VYMAZANIE COOKIES (Poistka proti "zombie" session)
  try {
    if (typeof document !== "undefined") {
      const cookies = document.cookie.split(";");
      const domain = window.location.hostname === 'localhost' ? '' : `domain=${window.location.hostname};`;
      
      for (let i = 0; i < cookies.length; i++) {
        const name = cookies[i].split("=")[0].trim();
        // Zmažeme úplne VŠETKY Supabase (sb-*) a naše (sr_*) cookies pre istotu
        if (name.startsWith("sb-") || name.startsWith("sr_") || name === "selfrace_numeric_id") {
           // Nastavíme expiráciu do roku 1970
           document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; ${domain}`;
        }
      }
    }
  } catch (e) {
    console.warn("[signOut] cookies cleanup failed:", e);
  }

  // ✅ 2. VYMAZANIE LOCALSTORAGE
  try {
    const LS_PREFIXES = ["sb-", "up:", "coach.", "selfrace:", "selfrace_"];
    const keys = Object.keys(window.localStorage);
    for (const key of keys) {
      if (LS_PREFIXES.some((p) => key.startsWith(p))) {
        window.localStorage.removeItem(key);
      }
    }
    window.localStorage.setItem("up:logout_at", String(Date.now()));
    window.sessionStorage.clear();
  } catch (e) {
    console.warn("[signOut] storage cleanup failed:", e);
  }

  // ✅ 3. PRESMEROVANIE
  if (typeof window !== "undefined") {
    // Použijeme replace, aby sa užívateľ nevedel šípkou 'späť' vrátiť do chránenej časti
    window.location.replace(redirectTo);
  }
}