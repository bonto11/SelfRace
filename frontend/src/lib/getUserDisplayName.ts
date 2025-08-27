// src/lib/getUserDisplayName.ts
import { supabase } from "./supabaseClient";

export default async function getUserDisplayName(authUid: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("users")
    .select("display_name")
    .eq("auth_uid", authUid)
    .single();

  if (error || !data) {
    return null;
  }

  return data.display_name;
}
