"use client";

import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";

export async function signOut(redirectTo: string = "/signin") {
  try {
    if (typeof window !== "undefined") {
      // Odomkneme trezor pre async adapter
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
    
    // 2. 🧟 Zmažeme "Nukleárny Trezor" z IndexedDB
    try {
        const idbKeyval = await import('idb-keyval');
        await idbKeyval.clear(); // Nukleárna voľba - zmaže všetky dáta z helper databázy
    } catch(e) {}

    window.location.replace(redirectTo);
  }
}