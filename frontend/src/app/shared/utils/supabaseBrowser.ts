"use client";

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config";

let _client: any = null;

export function getSupabaseBrowser() {
  if (typeof window === "undefined") {
    // Ak sme na serveri (Next.js SSR), vrátime len atrapu, aby to nepadlo
    return createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
  }

  // Ak sme v prehliadači, natvrdo použijeme LocalStorage
  if (!_client) {
    _client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage, // 🚀 Ultimátna záchrana pred redirectami
      },
    });
  }
  return _client;
}