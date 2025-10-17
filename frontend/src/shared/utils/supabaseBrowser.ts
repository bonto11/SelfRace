// src/shared/utils/supabaseBrowser.ts
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let sb: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
  if (sb) return sb;

  console.log("[SB][browser] create client (helpers nextjs)");
  sb = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get() { return null; },
        set() {},
        remove() {},
      },
    }
  );

  return sb;
}
