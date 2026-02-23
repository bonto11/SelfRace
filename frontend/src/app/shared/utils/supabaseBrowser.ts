// src/app/shared/utils/supabaseBrowser.ts
"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config";

let _client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowser() {
  if (!_client) {
    _client = createBrowserClient(
      SUPABASE_URL!,
      SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
        cookies: {
          get(name: string) {
            if (typeof window === 'undefined') return '';
            
            // 1. Zlatá baňa: Vyskúšame to načítať priamo z nezničiteľného LocalStorage
            const lsValue = window.localStorage.getItem(name);
            if (lsValue) return decodeURIComponent(lsValue);

            // 2. Fallback: Ak to nie je v LocalStorage, skúsime cookies
            const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
            return (match ? decodeURIComponent(match[3]) : '');
          },
          set(name: string, value: string, options: any) {
             if (typeof window === 'undefined') return;
             
             const encodedValue = encodeURIComponent(value);

             // ✅ Uložíme pevne do LocalStorage (Toto prežije "vyswipeovanie" apky na 100%)
             window.localStorage.setItem(name, encodedValue);
             
             // ✅ Uložíme do Cookies s brutálnym pancierom pre mobily
             // Vypočítame explicitný dátum expirácie o 1 rok, aby si mobil nemyslel, že to je "Session" cookie
             const date = new Date();
             date.setTime(date.getTime() + (365 * 24 * 60 * 60 * 1000));
             
             // Na HTTPS (napr. tvoj dev) vyžadujú mobily flag "Secure", inak to zmažú
             const isSecure = window.location.protocol === 'https:' ? '; Secure' : '';

             document.cookie = `${name}=${encodedValue}; path=/; expires=${date.toUTCString()}; max-age=31536000; SameSite=Lax${isSecure}`;
          },
          remove(name: string, options: any) {
             // 🛑 Blokujeme akékoľvek náhodné odhlásenia z frameworku
          }
        }
      }
    );
  }
  return _client;
}
