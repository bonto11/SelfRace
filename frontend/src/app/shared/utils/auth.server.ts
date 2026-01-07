// src/shared/utils/auth.server.ts
import "server-only";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "./supabaseServer";

/** Server-only: vráti prihláseného usera (alebo null). */
export async function getAuthUser() {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/** Server-only guard do (protected) layoutov. */
export async function requireAuth(redirectTo: string = "/signin") {
  const user = await getAuthUser();
  if (!user) redirect(redirectTo);
  return user;
}