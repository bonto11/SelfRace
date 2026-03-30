"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config";

export function getSupabaseBrowser() {
  // Čisté a oficiálne volanie. Supabase si sám riadi životnosť cookies na 1 rok.
  return createBrowserClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
}