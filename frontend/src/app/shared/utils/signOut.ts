"use client";

import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";

export async function signOut(redirectTo: string = "/signin") {
  try {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
  } catch (e) {
    console.warn("[signOut] error:", e);
  }

  if (typeof window !== "undefined") {
    // 1. Vyčistíme lokálne úložiská
    window.localStorage.clear(); 
    window.sessionStorage.clear();

    // 2. NUKLEÁRNY ÚDER NA COOKIES: 
    // Natvrdo vymažeme všetky Supabase cookies (aby sme obišli náš štít)
    document.cookie.split(";").forEach((c) => {
      const cookieName = c.split("=")[0].trim();
      // Ak cookie začína na "sb-", okamžite ju expirujeme
      if (cookieName.startsWith("sb-")) {
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      }
    });

    // 3. Hard reload na prihlasovaciu obrazovku (zabezpečí 100% čistý stav)
    window.location.replace(redirectTo);
  }
}