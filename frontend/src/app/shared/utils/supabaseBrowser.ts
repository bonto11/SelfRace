"use client";

// ✅ ZMENA: Namiesto @supabase/ssr použijeme štandardný klientský balíček
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
          // ✅ TOTO JE ZÁCHRANA: Natvrdo povieme Supabase, nech použije spoľahlivý LocalStorage
          storage: typeof window !== "undefined" ? window.localStorage : undefined,
        }
      }
    );
  }
  return _client;
}