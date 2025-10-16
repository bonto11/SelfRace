// src/shared/utils/supabaseServer.ts
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

export function getSupabaseServer(): SupabaseClient {
  // POZOR: tieto logy sa objavia často (pri každom server renderi).
  try {
    const cks = cookies();
    const ckNames = cks.getAll().map(c => c.name);
    console.log('[SB][server] create client, cookies present:', ckNames);
  } catch {
    // no-op (mimo request kontextu)
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookies().get(name)?.value,
        set: () => {},     // zápis robí middleware
        remove: () => {},  // zápis robí middleware
      },
    }
  );
}
