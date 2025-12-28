// src/shared/utils/supabaseBrowser.ts
"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    _client = createClient(url, anon, {
      auth: {
        persistSession: true,      // ulož session do storage
        autoRefreshToken: true,    // obnovuje access token na pozadí
      },
    });
  }

  return _client;
}