"use client";

import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";

export async function signOut(redirectTo: string = "/") {
  const supabase = getSupabaseBrowser();
  await supabase.auth.signOut();

  if (typeof window !== "undefined") {
    window.localStorage.removeItem("selfrace_numeric_id");
    window.location.replace(redirectTo);
  }
}