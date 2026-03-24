"use client";

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config";

let _client: any = null;

export function getSupabaseBrowser() {
  if (typeof window === "undefined") {
    return createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
  }

  if (!_client) {
    _client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // 🚀 TOTO JE ZÁCHRANA: Úplne nový kľúč. Ignoruje staré cookie bugy!
        storageKey: "selfrace-auth-token", 
        storage: window.localStorage, // Natvrdo vynútený LocalStorage
      },
    });
  }
  return _client;
}