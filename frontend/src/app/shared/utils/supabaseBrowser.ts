"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config";

let _client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowser() {
  if (!_client) {
    _client = createBrowserClient(
      SUPABASE_URL!,
      SUPABASE_ANON_KEY!
      // Zásadné: Žiadny objekt "cookies: {...}". 
      // Supabase sa sám rozhodne, či použije cookie chunking alebo localStorage.
    );
  }
  return _client;
}