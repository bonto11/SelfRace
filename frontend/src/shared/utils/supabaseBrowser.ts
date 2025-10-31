// src/shared/utils/supabaseBrowser.ts
import "server-only";                         // 👈 chráni pred klientskym importom
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export function getSupabaseServer(): SupabaseClient {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: () => {},      // zápis robíme v route/middleware
        remove: () => {},
      },
    }
  );
}