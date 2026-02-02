// src/shared/utils/supabaseServer.ts

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL,SUPABASE_ANON_KEY } from "@/app/shared/config";
export async function getSupabaseServer(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(
    SUPABASE_URL!,
    SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // ak sa to zavolá zo Server Componentu, Next to nemusí povoliť – môžeme ignorovať
          }
        },
      },
    }
  );
}