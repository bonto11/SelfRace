// src/app/shared/utils/supabaseBrowser.ts
"use client";

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config";

// ✅ Vlastný SYNCHRÓNNY storage cez Cookies. 
// Prežije iOS swipe kill a nespôsobí asynchrónny výpadok (race-condition).
const syncCookieStorage = {
  getItem: (key: string) => {
    if (typeof document === 'undefined') return null;
    const name = encodeURIComponent(key);
    const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
    return match ? decodeURIComponent(match[3]) : null;
  },
  setItem: (key: string, value: string) => {
    if (typeof document === 'undefined') return;
    // Zabetónujeme na 1 rok
    document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax; Secure`;
  },
  removeItem: (key: string) => {
    if (typeof document === 'undefined') return;
    // Bezpečné zmazanie
    document.cookie = `${encodeURIComponent(key)}=; path=/; max-age=0; SameSite=Lax; Secure`;
  }
};

let _client: ReturnType<typeof createClient> | null = null;

export function getSupabaseBrowser() {
  if (!_client) {
    _client = createClient(
      SUPABASE_URL!,
      SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: 'selfrace-cookie-session', // Nový názov
          storage: syncCookieStorage, // 🚀 Vynútime naše synchrónne cookies
        }
      }
    );
  }
  return _client;
}
