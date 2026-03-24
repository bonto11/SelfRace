"use client";

import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";

export async function signOut(redirectTo: string = "/signin") {
  // 1. Povieme Supabase, že končíme
  try {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
  } catch (e) {
    console.warn("[signOut] error:", e);
  }

  // 2. Brutálne a nekompromisné vymazanie Cookies
  try {
    if (typeof document !== "undefined") {
      const cookies = document.cookie.split(";");
      for (let i = 0; i < cookies.length; i++) {
        const name = cookies[i].split("=")[0].trim();
        if (name.startsWith("sb-") || name.startsWith("sr_") || name === "selfrace_numeric_id") {
           document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
        }
      }
    }
  } catch (e) {
    console.warn("[signOut] cookie cleanup failed:", e);
  }

  // 3. Brutálne a nekompromisné vymazanie LocalStorage
  try {
    const LS_PREFIXES = ["sb-", "up:", "coach.", "selfrace:", "selfrace_"];
    const keys = Object.keys(window.localStorage);
    for (const key of keys) {
      if (LS_PREFIXES.some((p) => key.startsWith(p))) {
        window.localStorage.removeItem(key);
      }
    }
    window.sessionStorage.clear();
  } catch (e) {
    console.warn("[signOut] storage cleanup failed:", e);
  }

  // 4. Bezpečné presmerovanie (zabraňuje cykleniu)
  if (typeof window !== "undefined") {
    window.location.replace(redirectTo);
  }
}