// src/app/shared/utils/supabaseBrowser.ts
"use client";

// ✅ 1. Odstránili sme @supabase/ssr a importujeme čistý klientsky balík
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config";

let _client: ReturnType<typeof createClient> | null = null;

export function getSupabaseBrowser() {
  if (!_client) {
    _client = createClient(
      SUPABASE_URL!,
      SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          // ✅ 2. Vlastný kľúč. Bude pevne zabetónovaný v LocalStorage.
          storageKey: 'selfrace-pwa-session', 
          // ✅ 3. Vyslovene prikážeme použiť LocalStorage (žiadne cookies)
          storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        }
      }
    );
  }
  return _client;
}
