"use client";

// ✅ Používame základný, najstabilnejší klient pre SPA (nepotrebujeme SSR cookies)
import { createClient } from "@supabase/supabase-js"; 
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config";

let _client: ReturnType<typeof createClient> | null = null;

export function getSupabaseBrowser() {
  if (!_client) {
    _client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // ✅ Natvrdo prikážeme uložiť token do LocalStorage, odkiaľ nikdy pri F5 nezmizne
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
      }
    });
  }
  return _client;
}