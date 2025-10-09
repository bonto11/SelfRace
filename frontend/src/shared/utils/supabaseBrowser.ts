// src/shared/utils/supabaseBrowser.ts
'use client';
import { createBrowserClient } from '@supabase/ssr';

let _sb:
  | ReturnType<typeof createBrowserClient<any>>
  | null = null;

/**
 * Singleton browser client s perzistentnou session
 * a auto-refreshom. Vytvorí sa len raz.
 */
export function getSupabaseBrowser() {
  if (_sb) return _sb;

  _sb = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // lokálne úložisko prehliadača
        storage:
          typeof window !== 'undefined'
            ? window.localStorage
            : undefined,
      },
    }
  );

  return _sb;
}

// ak niekde importuješ aliasom
export const supabaseBrowser = getSupabaseBrowser;
