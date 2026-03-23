"use client";

import { createClient } from "@supabase/supabase-js"; 
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config";

let _client: ReturnType<typeof createClient> | null = null;

export function getSupabaseBrowser() {
  // 🚨 1. SSR OCHRANA: Ak bežíme na serveri, vrátime len dočasnú prázdnu atrapu.
  // HLAVNE ju neuložíme do globálnej premennej _client!
  if (typeof window === "undefined") {
    return createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: false }
    });
  }

  // ✅ 2. SME V PREHLIADAČI: Tu už window existuje. Bezpečne pripojíme LocalStorage.
  if (!_client) {
    _client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage, // Tu už s istotou vie, že má použiť disk!
      }
    });
  }
  return _client;
}