"use client";

import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";

export async function signOut(redirectTo: string = "/signin") {
  try {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
  } catch (e) {
    console.warn("[signOut] error:", e);
  }

  // Clear your custom app state
  try {
     if (typeof window !== "undefined") {
         window.localStorage.removeItem("selfrace_numeric_id");
         window.localStorage.removeItem("selfrace_uuid");
     }
  } catch(e) {}

  if (typeof window !== "undefined") {
    window.location.replace(redirectTo);
  }
}
