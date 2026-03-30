"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config";

let _client: any = null;

export function getSupabaseBrowser() {
  if (!_client) {
    // Vytvorí sa len raz a drží si spojenie
    _client = createBrowserClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
  }
  return _client;
}