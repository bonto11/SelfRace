// src/shared/utils/supabaseBrowser.ts
import { createBrowserClient } from "@supabase/ssr";

export function getSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// (voliteľne) alias, ak to niekde voláš iným menom
export const supabaseBrowser = getSupabaseBrowser;
