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
    window.localStorage.clear(); // Nukleárna voľba - zmaže všetko
    window.location.replace(redirectTo);
  }
}