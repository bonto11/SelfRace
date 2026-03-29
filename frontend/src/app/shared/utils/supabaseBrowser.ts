// src/app/shared/utils/supabaseBrowser.ts (or wherever it is located)
"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config";

let _client: any = null;

export function getSupabaseBrowser() {
  if (!_client) {
    _client = createBrowserClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
  }
  return _client;
}
