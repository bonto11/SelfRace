// src/app/shared/utils/supabaseBrowser.ts
"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config";

let _client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowser() {
  if (!_client) {
    console.log("[AUTH_DEBUG: BrowserClient] Vytváram SSR klienta s OCHRANOU COOKIES...");
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
             console.log(`[AUTH_DEBUG: Cookie SET] Zapisujem/Obnovujem cookie: ${name}`);
             document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
          },
          remove(name: string, options: any) {
             // 🔴 TOTO NÁS ZACHRÁNI: Blokujeme zmazanie pri refreshi!
             console.warn(`[AUTH_DEBUG: Cookie REMOVE] 🛑 ZABRÁNENÉ zmazaniu cookie: ${name}! Prehliadač (alebo Next) sa snažil zmazať session, ale nedovolili sme to.`);
          }
        }
      }
    );
  }
  return _client;
}