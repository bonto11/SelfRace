"use client";

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config";

// ✅ 1. Klienta vytvoríme priamo tu. Tým pádom sa v browseri okamžite napojí na LocalStorage.
export const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);

// ✅ 2. Necháme tu túto funkciu, aby sme ti nerozbili SignInForm.tsx a signOut.ts
export function getSupabaseBrowser() {
  return supabase;
}