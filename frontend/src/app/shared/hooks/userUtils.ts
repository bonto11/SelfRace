// src/lib/userUtils.ts
"use client";

import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { callBackend } from "@/app/shared/utils/callBackend";

const supabase = getSupabaseBrowser();

/**
 * Zabezpečí načítanie (a potenciálne overenie existencie) usera cez Python be.
 */
export async function ensureUserExists(authUid: string): Promise<number | null> {
  try {
    // Voláme tvoj FastAPI endpoint presne tak, ako je definovaný: POST /users/resolve
    const response = await callBackend<{ success: boolean; error?: string; user_id?: number }>(
      "/users/resolve",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auth_uid: authUid }),
      }
    );

    if (response?.success && typeof response.user_id === "number") {
      return response.user_id;
    }
    
    console.error("❌ Backend vrátil neúspech pre resolve:", response?.error);
    return null;

  } catch (e) {
    console.error("❌ ensureUserExists zlyhal pri volaní /users/resolve.", e);
    return null;
  }
}

/**
 * Vracia interné `users.id` pre aktuálne prihláseného usera.
 */
export async function getUserId(): Promise<number | null> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("❌ getUserId: žiadny prihlásený user v Supabase.");
    return null;
  }

  // Odovzdáme auth_uid do našej helper funkcie
  return await ensureUserExists(user.id);
}