// src/lib/userUtils.ts
"use client";

import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { callBackend } from "@/app/shared/utils/callBackend";

const supabase = getSupabaseBrowser();

/**
 * Už nepotrebujeme zapisovať do DB z frontendu.
 * Povieme len Python backendu, aby nám vrátil profil a ten si ho prípadne sám vytvorí.
 */
export async function ensureUserExists(): Promise<number | null> {
  try {
    // Predpokladám, že máš v Pythone nejaký /me alebo /users endpoint, ktorý ti vráti tvoje číselné ID.
    // Ak nemáš, tak to budeš musieť vyriešiť na backende, aby tvoj Python po prihlásení usera zaregistroval.
    const userProfile = await callBackend("/users/me");
    return userProfile?.id ?? null;
  } catch (e) {
    console.error("❌ ensureUserExists zlyhal. Backend neodpovedal alebo nemáš /users/me endpoint.", e);
    return null;
  }
}

/**
 * Vracia interné `users.id` pre aktuálne prihláseného usera.
 */
export async function getUserId(): Promise<number | null> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("❌ getUserId: žiadny prihlásený user");
    return null;
  }

  return await ensureUserExists();
}