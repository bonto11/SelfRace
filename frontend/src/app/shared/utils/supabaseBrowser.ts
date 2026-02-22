// src/app/shared/utils/supabaseBrowser.ts
"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config";

let _client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowser() {
  if (!_client) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Missing Supabase env vars");
    }

    // createBrowserClient automaticky ukladá session do Cookies, nie do localStorage!
    // Vďaka tomu ich Next.js server vždy bezpečne vidí.
    _client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _client;
}