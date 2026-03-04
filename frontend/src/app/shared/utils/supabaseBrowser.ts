// src/app/shared/utils/supabaseBrowser.ts

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
          detectSessionInUrl: true, // Kľúčové pre návrat zo Stravy/Stripe (hash v URL)
          flowType: 'pkce',
        },
        cookies: {
          get(name: string) {
            if (typeof document === 'undefined') return '';
            const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
            return (match ? decodeURIComponent(match[3]) : '');
          },
          set(name: string, value: string, options: any) {
            if (typeof document === 'undefined') return;
            
            // Supabase posiela options (maxAge, path, atď.), mali by sme ich rešpektovať
            let cookieStr = `${name}=${encodeURIComponent(value)}; `;
            
            // Základné nastavenia pre stabilitu
            cookieStr += `path=/; `;
            
            // SameSite=Lax je kritické pre redirecty zo Stripe/Strava
            // Aby prehliadač poslal cookie aj pri návrate z inej domény
            cookieStr += `SameSite=Lax; `;

            if (options?.maxAge) {
              cookieStr += `max-age=${options.maxAge}; `;
            } else {
              // Ak nie je maxAge, dáme rok, aby refresh okna neodhlásil
              cookieStr += `max-age=${60 * 60 * 24 * 365}; `;
            }

            if (process.env.NODE_ENV === 'production') {
              cookieStr += `Secure; `;
            }

            document.cookie = cookieStr;
          },
          remove(name: string, options: any) {
            if (typeof document === 'undefined') return;
            // Pri remove musíme nastaviť max-age na 0
            document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
          }
        }
      }
    );
  }
  return _client;
}

/*
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
             document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
          },
          remove(name: string, options: any) {
          }
        }

      }
    );
  }
  return _client;
}
  */