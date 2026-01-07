// src/app/shared/utils/supabaseBrowser.ts
"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// vlastný kľúč v localStorage – ľahko ho nájdeš v DevTools
const STORAGE_KEY = "sb-selfrace-auth-token";

let _client: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
  if (!_client) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Missing Supabase env vars");
    }

    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,        // <<< kľúčové
        autoRefreshToken: true,      // obnovuje tokeny na pozadí
        detectSessionInUrl: true,
        storageKey: STORAGE_KEY,     // budeš vidieť v localStorage
      },
    });
  }
  return _client;
}