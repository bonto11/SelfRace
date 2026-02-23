// src/app/shared/utils/supabaseBrowser.ts
"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config";

let _client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowser() {
  if (!_client) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Missing Supabase env vars");
    }

    _client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        // Tieto dve nastavenia sú kritické pre bezproblémový návrat zo Stravy
        detectSessionInUrl: true, 
        autoRefreshToken: true,
      },
    });
  }
  return _client;
}