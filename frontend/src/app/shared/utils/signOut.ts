"use client";

import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";

export async function signOut(redirectTo: string = "/signin") {
  try {
    if (typeof window !== "undefined") {
      // Odomkneme trezor, aby Supabase mohol zmazať kľúče
      window.sessionStorage.setItem("explicit_logout", "true"); 
    }
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
  } catch (e) {
    console.warn("[signOut] error:", e);
  }

  if (typeof window !== "undefined") {
    // 1. Zmažeme úplne všetko v LocalStorage
    window.localStorage.clear(); 
    
    // 2. 🍏 Zmažeme "Kryptonit" Cookie
    try {
        document.cookie = "sr_vault_cookie=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
    } catch(e) {}

    window.location.replace(redirectTo);
  }
}