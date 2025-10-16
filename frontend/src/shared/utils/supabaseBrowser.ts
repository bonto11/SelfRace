// src/shared/utils/supabaseBrowser.ts
'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let _sb: SupabaseClient | null = null;

/**
 * Singleton Supabase browser client:
 * - session sa drží v sessionStorage (prežije refresh, zanikne po zavretí karty)
 * - autoRefreshToken zapnutý
 * - detectSessionInUrl zapnuté (po OAuth callbacku)
 */
export function getSupabaseBrowser(): SupabaseClient {
  if (_sb) return _sb;

  _sb = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // per-tab storage – de facto „stay signed in until you close the tab“
        storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
      },
    }
  );

  // istota: spusti auto-refresh (no-op, ak už beží)
  if (typeof window !== 'undefined') {
    try {
      (_sb as any).auth.startAutoRefresh?.();
    } catch {}
  }

  return _sb;
}

/** Pomocník – bezpečne načíta aktuálneho usera na cliente. */
export async function getCurrentUser() {
  const sb = getSupabaseBrowser();
  const { data } = await sb.auth.getUser();
  return data.user ?? null;
}
