// src/app/shared/utils/supabaseBrowser.ts
"use client";

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config";

let _client: ReturnType<typeof createClient> | null = null;

export function getSupabaseBrowser() {
  if (!_client) {
    console.log("[AUTH_DEBUG: BrowserClient] Vytváram novú inštanciu Supabase JS klienta...");
    _client = createClient(
      SUPABASE_URL!,
      SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          storageKey: 'selfrace-auth-session', 
          storage: typeof window !== 'undefined' ? window.localStorage : undefined,
          detectSessionInUrl: true,
          autoRefreshToken: true,
        }
      }
    );
    console.log("[AUTH_DEBUG: BrowserClient] Klient vytvorený. StorageKey: 'selfrace-auth-session'");
  }
  return _client;
}