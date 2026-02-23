// src/app/shared/utils/supabaseBrowser.ts
"use client";

// ✅ Zmena: Použijeme klasický supabase-js klient namiesto SSR klienta.
// Tento ukladá session do LocalStorage a NIKDY ju nestratí pri refreshi.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config";

let _client: SupabaseClient | null = null;

export function getSupabaseBrowser() {
  if (!_client) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Missing Supabase env vars");
    }

    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }
  return _client;
}