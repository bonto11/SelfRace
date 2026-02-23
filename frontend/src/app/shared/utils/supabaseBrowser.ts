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
        // Tieto nastavenia zabezpečia, že sa token po Strave správne prečíta z URL
        detectSessionInUrl: true, 
        autoRefreshToken: true,
        persistSession: true,
      },
    });
  }
  return _client;
}