// src/lib/userUtils.ts
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";

/**
 * Zabezpečí, že user existuje v tabuľke `users`.
 * Ak neexistuje, vloží ho. Vráti jeho numerické id.
 */
export async function ensureUserExists(authUid: string, email: string): Promise<number | null> {

  const supabase = getSupabaseBrowser();
  // Skús nájsť užívateľa
  const { data: existing, error: selError } = await supabase
    .from("users")
    .select("id")
    .eq("auth_uid", authUid)
    .limit(1);

  if (selError) {
    console.error("❌ Chyba pri hľadaní usera:", selError);
    return null;
  }
  
  if (existing && existing.length > 0) {
    return existing[0].id;
  }

  // Ak neexistuje → vytvor
  const { data: inserted, error: insError } = await supabase
    .from("users")
    .insert({
      auth_uid: authUid,
      mail_address: email,
      display_name: email.split("@")[0],
    })
    .select("id")
    .single();

  if (insError) {
    console.error("❌ Chyba pri vkladaní usera:", insError);
    return null;
  }

  return inserted?.id ?? null;
}

/**
 * Vracia interné `users.id` pre aktuálne prihláseného usera.
 */
export async function getUserId(): Promise<number | null> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("❌ getUserId: žiadny prihlásený user");
    return null;
  }

  return await ensureUserExists(user.id, user.email ?? "");
}
