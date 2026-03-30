"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config";

let _client: any = null;

export function getSupabaseBrowser() {
  if (!_client) {
    _client = createBrowserClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      // 🚀 TOTO JE TEN KĽÚČ: Vynútime trvalú cookie platnú 1 rok na frontende
      cookieOptions: {
        maxAge: 31536000, 
        path: "/",
        sameSite: "lax",
      }
    });
  }
  return _client;
}