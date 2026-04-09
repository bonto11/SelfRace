import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/app/shared/config"; 

// 1. DÔLEŽITÉ: Funkcia teraz musí byť 'async'
export async function getSupabaseServer() {
  // 2. DÔLEŽITÉ: Musíme počkať na cookies pomocou 'await'
  const cookieStore = await cookies();

  return createServerClient(
    SUPABASE_URL!,
    SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // Táto chyba vzniká, ak sa snažíme nastaviť cookie v Server Componente.
            // Ignorujeme ju, pretože o obnovu tokenu sa nám už stará Middleware.
          }
        },
      },
    }
  );
}