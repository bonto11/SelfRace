"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config";

let _client: any = null;

export function getSupabaseBrowser() {
  if (!_client) {
    _client = createBrowserClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);

    // 🕵️ KLIENT DETEKTÍV
    _client.auth.onAuthStateChange((event: string, session: any) => {
      console.log(`[KLIENT DETEKTÍV] Udalosť v prehliadači: ${event}`);
      if (event === 'SIGNED_OUT') {
         console.trace("[KLIENT DETEKTÍV] 🛑 Prehliadač vymazal session na základe príkazu! Stack trace:");
      }
    });
  }
  return _client;
}