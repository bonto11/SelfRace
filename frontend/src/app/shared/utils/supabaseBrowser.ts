// src/app/shared/utils/supabaseBrowser.ts
"use client";

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
          storageKey: 'selfrace-auth-session', // Vlastný kľúč = imunita voči Next.js
          storage: typeof window !== 'undefined' ? window.localStorage : undefined,
          detectSessionInUrl: true,
          autoRefreshToken: true,
        }
      }
    );
  }
  return _client;
}
