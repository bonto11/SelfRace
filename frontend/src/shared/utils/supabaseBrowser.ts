// src/shared/utils/supabaseBrowser.ts
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let sb: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
  if (sb) {
    console.log("[SB][browser] reuse existing client");
    return sb;
  }

  console.log("[SB][browser] created client (helpers nextjs)");

  sb = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // ⚠️ Browser nesmie čítať cookie s tokenmi
        get() {
          return null;
        },
        set() {},
        remove() {},
      },
    }
  );

  return sb;
}
