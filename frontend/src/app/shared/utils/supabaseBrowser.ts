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
            return (match ? decodeURIComponent(match[3]) : '');
          },
          set(name: string, value: string, options: any) {
             if (typeof document === 'undefined') return;
             // Pridáme max-age aby cookie žila, ale necháme Supabase spravovať detaily
             document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
          },
          remove(name: string, options: any) {
             if (typeof document === 'undefined') return;
             // ✅ OPRAVA: Pre vymazanie cookie jej musíme nastaviť expiráciu do minulosti
             document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
          }
        }
      }
    );
  }
  return _client;
}
