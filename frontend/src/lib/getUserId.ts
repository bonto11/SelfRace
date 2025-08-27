// src/lib/getUserId.ts
import { supabase } from "./supabaseClient";

export default async function getUserId(authUid: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("auth_uid", authUid)
    .single();

  if (error || !data) {
    console.error("Nepodarilo sa nájsť user_id:", error, authUid);
    return null;
  }

  return data.id;
}
