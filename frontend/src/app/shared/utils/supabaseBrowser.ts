"use client";

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config";

let _client: any = null;

// 🔥 TREZOR: Tento adaptér odmietne zmazať session, kým mu to explicitne nedovolíme
const vaultStorage = {
  getItem: (key: string) => {
    if (typeof window === "undefined") return null;
    let val = window.localStorage.getItem(key);
    if (!val) {
       val = window.localStorage.getItem(key + "_backup");
       if (val) window.localStorage.setItem(key, val);
    }
    return val;
  },
  setItem: (key: string, value: string) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
    window.localStorage.setItem(key + "_backup", value); // Dvojitá záloha
  },
  removeItem: (key: string) => {
    if (typeof window === "undefined") return;
    // Povolíme zmazanie IBA ak používateľ klikol na tlačidlo Odhlásiť
    if (window.sessionStorage.getItem("explicit_logout") === "true") {
      window.localStorage.removeItem(key);
      window.localStorage.removeItem(key + "_backup");
    } else {
      console.warn("🛡️ Supabase chcel zmazať token (asi kvôli redirectu). ZABLOKOVANÉ!");
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
        detectSessionInUrl: false, // 🚀 ZAKÁŽEME mu čítať URL (aby ho nezmiatla Strava)
        storageKey: "sr_vault_session",
        storage: vaultStorage,
      },
    });
  }
  return _client;
}