// src/shared/utils/supabaseBrowser.ts
'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';

let _sb: SupabaseClient | null = null;

/** Singleton – klient, ktorý synchronizuje session do httpOnly cookies cez middleware. */
export function getSupabaseBrowser(): SupabaseClient {
  if (_sb) {
    if (typeof window !== 'undefined') {
      console.log('[SB][browser] reuse existing client');
    }
    return _sb;
  }
  _sb = createClientComponentClient();
  if (typeof window !== 'undefined') {
    console.log('[SB][browser] created client (helpers nextjs)');
  }
  return _sb;
}
