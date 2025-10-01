// src/shared/utils/auth.ts
import { redirect } from "next/navigation";
import { getSupabaseServer } from "./supabaseServer";

/** Získa prihláseného usera (alebo null). Server-only. */
export async function getAuthUser() {
  const supabase = getSupabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/** Vyžaduje prihlásenie – inak presmeruje. Použi v (protected)/layout.tsx */
export async function requireAuth(redirectTo: string = "/signin") {
  const user = await getAuthUser();
  if (!user) redirect(redirectTo);
  return user;
}