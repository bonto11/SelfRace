"use client";

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config";

let _client: any = null;

// 🔥 TREZOR V2 (Kryptonit na PWA): Zrkadlíme LocalStorage do Cookies
const vaultStorage = {
  getItem: (key: string) => {
    if (typeof window === "undefined") return null;
    
    // 1. Skúsime LocalStorage
    let val = window.localStorage.getItem(key);
    if (!val) val = window.localStorage.getItem(key + "_backup");
    
    // 2. 🚀 AK APPLE ZMAZAL LS PO SWAJPNUTÍ, VYŤAHUJEME Z COOKIE!
    if (!val) {
        const match = document.cookie.match(new RegExp('(^| )sr_vault_cookie=([^;]+)'));
        if (match) {
            try {
                val = decodeURIComponent(match[2]);
                // Okamžite oživíme LocalStorage späť
                window.localStorage.setItem(key, val);
                window.localStorage.setItem(key + "_backup", val);
                console.log("🧟 PWA zmazalo LocalStorage! Úspešne oživené z Cookie!");
            } catch(e) {}
        }
    }
    return val;
  },
  setItem: (key: string, value: string) => {
    if (typeof window === "undefined") return;
    
    // Uložíme do LS
    window.localStorage.setItem(key, value);
    window.localStorage.setItem(key + "_backup", value);
    
    // 🚀 ZÁLOHA DO TRVALEJ COOKIE (Platnosť 1 rok, nezmazateľné swajpnutím)
    try {
       const d = new Date();
       d.setTime(d.getTime() + (365*24*60*60*1000));
       document.cookie = "sr_vault_cookie=" + encodeURIComponent(value) + ";expires=" + d.toUTCString() + ";path=/;SameSite=Lax";
    } catch(e) {}
  },
  removeItem: (key: string) => {
    if (typeof window === "undefined") return;
    
    if (window.sessionStorage.getItem("explicit_logout") === "true") {
      window.localStorage.removeItem(key);
      window.localStorage.removeItem(key + "_backup");
      // Zmažeme aj Cookie
      document.cookie = "sr_vault_cookie=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
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
        detectSessionInUrl: false,
        storageKey: "sr_vault_session",
        storage: vaultStorage,
      },
    });
  }
  return _client;
}