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
            
            let cookieStr = `${name}=${encodeURIComponent(value)}`;
            
            // Dynamicky prevezmeme nastavenia zo Supabase, alebo dáme bezpečné fallbacky
            cookieStr += options.path ? `; path=${options.path}` : `; path=/`;
            cookieStr += options.domain ? `; domain=${options.domain}` : ``;
            // Držíme session aktívnu dlhodobo (1 rok), ak Supabase nepovie inak
            cookieStr += options.maxAge ? `; max-age=${options.maxAge}` : `; max-age=${60 * 60 * 24 * 365}`;
            cookieStr += options.sameSite ? `; SameSite=${options.sameSite}` : `; SameSite=Lax`;
            if (options.secure) cookieStr += `; Secure`;

            document.cookie = cookieStr;
          },
          remove(name: string, options: any) {
            if (typeof document === 'undefined') return;
            
            // ✅ KĽÚČOVÁ OPRAVA PRE CYKLOVANIE:
            // Pre vymazanie cookie musíme použiť rovnaký path a domain, ako pri jej vytvorení!
            let cookieStr = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
            cookieStr += options.path ? `; path=${options.path}` : `; path=/`;
            cookieStr += options.domain ? `; domain=${options.domain}` : ``;
            
            document.cookie = cookieStr;
          }
        }
      }
    );
  }
  return _client;
}