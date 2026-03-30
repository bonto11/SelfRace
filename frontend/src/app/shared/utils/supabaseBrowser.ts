"use client";

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config";
import * as idbKeyval from 'idb-keyval';

let _client: any = null;

const vaultDBStorage = {
  getItem: async (key: string) => {
    if (typeof window === "undefined") return null;
    
    let val: string | null = window.localStorage.getItem(key);
    
    if (!val) {
        try {
            // ✅ OPRAVA TS: Ošetrili sme undefined z IndexedDB
            const dbVal = await idbKeyval.get<string>(key);
            if (dbVal) {
                val = dbVal;
                window.localStorage.setItem(key, val);
                console.log("🧟 PWA zmazalo LocalStorage! Úspešne oživené z IndexedDB!");
            }
        } catch(e) {}
    }
    return val;
  },
  setItem: async (key: string, value: string) => {
    if (typeof window === "undefined") return;
    
    window.localStorage.setItem(key, value);
    
    try {
       await idbKeyval.set(key, value);
    } catch(e) {}
  },
  removeItem: async (key: string) => {
    if (typeof window === "undefined") return;
    
    if (window.sessionStorage.getItem("explicit_logout") === "true") {
      window.localStorage.removeItem(key);
      await idbKeyval.del(key);
    }
  }
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
        storageKey: "sr_vault_stable", 
        storage: vaultDBStorage,
      },
    });
  }
  return _client;
}