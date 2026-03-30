"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config";

let _client: any = null;

export function getSupabaseBrowser() {
  if (!_client) {
    // Vytvorí sa len raz a drží si spojenie
    _client = createBrowserClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);

    // 🚨 DETEKTÍV: Odpočúvame všetky udalosti
    _client.auth.onAuthStateChange((event: string, session: any) => {
      console.log(`[SUPABASE DETEKTÍV] Zaznamenaná udalosť: ${event}`);
      
      if (event === 'SIGNED_OUT') {
         // Tento riadok vygeneruje "Stack Trace" - cestu k súboru, ktorý to zavolal!
         console.trace("[SUPABASE DETEKTÍV] 🛑 NIEKTO ZMAZAL SESSION! Pozri si výpis pod týmto textom:");
      }
    });
  }
  return _client;
}