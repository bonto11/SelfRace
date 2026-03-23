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
            if (typeof document === 'undefined') return '';
            const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
            return match ? decodeURIComponent(match[3]) : '';
          },
          set(name: string, value: string, options: any) {
            if (typeof document === 'undefined') return;
            // 🚨 NATVRDO: max-age=31536000 (1 rok). Toto zabráni strate session pri redirecte.
            document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
          },
          remove(name: string, options: any) {
            if (typeof document === 'undefined') return;
            // 🚨 NATVRDO: Okamžité zmazanie pre celú doménu
            document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
          }
        }
      }
    );
  }
  return _client;
}
