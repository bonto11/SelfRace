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

  // 2. Brutálne a nekompromisné vymazanie LocalStorage
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

  // 3. Bezpečné presmerovanie (zabraňuje cykleniu)
  if (typeof window !== "undefined") {
    window.location.replace(redirectTo);
  }
}