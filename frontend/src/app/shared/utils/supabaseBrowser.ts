"use client";

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config";

let _client: any = null;

// 🚀 NEZNIČITEĽNÝ ADAPTÉR: Dovolí Supabase zapísať a čítať token, ale zakáže mu ho zmazať pri F5!
const indestructibleAdapter = {
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
    if (typeof window === "undefined") return;
    
    // TOTO JE TEN HACK! Ak sa Supabase (alebo nejaký iný tvoj kód) pokúsi zmazať
    // kľúče auth-token alebo numeric_id, jednoducho tento príkaz odignorujeme.
    if (key === "selfrace-auth-token" || key === "selfrace_numeric_id" || key === "selfrace_uuid") {
      console.log(`🛡️ Blokujem pokus o zmazanie ${key}! Token zostáva v bezpečí.`);
      return; 
    }
    
    // Ostatné kľúče (napr. subscription tier) nech si maže ako chce
    window.localStorage.removeItem(key);
  },
};

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
        storageKey: "selfrace-auth-token", 
        storage: indestructibleAdapter, // Nasadzujeme nezničiteľný adaptér!
      },
    });
  }
  return _client;
}