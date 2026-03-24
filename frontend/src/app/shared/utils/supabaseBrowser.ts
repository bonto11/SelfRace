"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config";

let _client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowser() {
  if (!_client) {
    _client = createBrowserClient(
      SUPABASE_URL!,
      SUPABASE_ANON_KEY!
      // 🚨 VYMAZANÉ: Naše ručné zapisovanie cookies.
      // Dôvod: JWT token je príliš veľký (>4KB). Ak to necháme na @supabase/ssr,
      // knižnica si ho sama bezpečne "rozseká" (chunking) a prehliadač ho už nezahodí!
    );
  }
  return _client;
}