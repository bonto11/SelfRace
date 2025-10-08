// src/shared/utils/supabaseServer.ts
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

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
