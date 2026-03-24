"use client";

import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";

export async function signOut(redirectTo: string = "/signin") {
  try {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
  } catch (e) {
    console.warn("[signOut] error:", e);
  }

  try {
    if (typeof document !== "undefined") {
      const cookies = document.cookie.split(";");
      for (let i = 0; i < cookies.length; i++) {
        const name = cookies[i].split("=")[0].trim();
        if (name.startsWith("sb-") || name.startsWith("sr_") || name === "selfrace_numeric_id" || name.startsWith("selfrace-")) {
           document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
        }
      }
    }
  } catch (e) {}

  try {
    // OBIDENIE PASCE: Použijeme Storage.prototype.removeItem priamo z jadra prehliadača
    const originalRemoveItem = Storage.prototype.removeItem;
    const originalClear = Storage.prototype.clear;

    const LS_PREFIXES = ["sb-", "up:", "coach.", "selfrace:", "selfrace_", "selfrace-"];
    const keys = Object.keys(window.localStorage);
    
    for (const key of keys) {
      if (LS_PREFIXES.some((p) => key.startsWith(p))) {
        originalRemoveItem.call(window.localStorage, key);
      }
    }
    originalClear.call(window.sessionStorage);
  } catch (e) {
      console.warn("[signOut] Hard cleanup failed", e);
  }

  if (typeof window !== "undefined") {
    window.location.replace(redirectTo);
  }
}