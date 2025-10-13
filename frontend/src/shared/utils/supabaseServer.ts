// src/shared/utils/supabaseServer.ts
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

/** Používaj v RSC a všade, kde nepotrebuješ zapisovať cookies. */
export function getSupabaseServer() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // v RSC len ČÍTAME; zápis robí middleware
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set() {},
        remove() {},
      },
    }
  )
}

/** Používaj iba v Route Handleroch / Server Actions – umožní ZÁPIS cookies. */
export function getSupabaseServerWritable() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}