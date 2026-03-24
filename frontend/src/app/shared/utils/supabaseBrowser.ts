"use client";

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config";

let _client: any = null;

// 🚀 Vlastný adaptér: Garantuje, že Supabase nemá inú možnosť, len použiť LocalStorage
const localStorageAdapter = {
  getItem: (key: string) => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, value);
    }
  },
  removeItem: (key: string) => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(key);
    }
  },
};

export function getSupabaseBrowser() {
  if (typeof window === "undefined") {
    // Sme na serveri (Next.js SSR), vrátime atrapu
    return createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
  }

  // Sme v prehliadači, natvrdo použijeme náš adaptér
  if (!_client) {
    _client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: localStorageAdapter, // Záchrana!
      },
    });
  }
  return _client;
}