// src/shared/utils/supabaseBrowser.ts
"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    _client = createBrowserClient(url, anon, {
      auth: {
        // kľúčové veci:
        persistSession: true,           // ulož do storage, nech prežije refresh
        autoRefreshToken: true,         // obnovuje access_token na pozadí
        detectSessionInUrl: true,       // keby si neskôr riešil magic-link / OAuth
        storageKey: "selfrace-auth-v1", // vlastný názov, stabilný naprieč buildmi
      },
    });
  }
  return _client;
}