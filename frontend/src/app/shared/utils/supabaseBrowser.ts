"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config";

let _client: any = null;

export function getSupabaseBrowser() {
  if (!_client) {
    _client = createBrowserClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      cookieOptions: {
        name: 'selfrace-token', // 🚀 MUSÍ BYŤ ROVNAKÝ AKO V MIDDLEWARE
        maxAge: 31536000,       // 1 rok
        path: '/',
        sameSite: 'lax',
      }
    });

    // 🚨 DETEKTÍV: Odpočúvame všetky udalosti
    _client.auth.onAuthStateChange((event: string, session: any) => {
      console.log(`[SUPABASE DETEKTÍV] Zaznamenaná udalosť: ${event}`);
      
      if (event === 'SIGNED_OUT') {
         // Vygeneruje stack trace, ak by sa session aj tak zmazala
         console.trace("[SUPABASE DETEKTÍV] 🛑 NIEKTO ZMAZAL SESSION! Pozri si výpis pod týmto textom:");
      }
    });
  }
  return _client;
}