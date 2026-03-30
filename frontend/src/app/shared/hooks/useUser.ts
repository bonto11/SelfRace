"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { useRouter } from "next/navigation";

export function useUser(redirectToLogin: boolean = false) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = getSupabaseBrowser();

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      let currentUser = null;

      // 1. Skúsime slušne cez Supabase getSession
      const { data: { session } } = await supabase.auth.getSession();
      currentUser = session?.user ?? null;

      // 2. Ak nevyšlo, skúsime priamy getUser dotaz
      if (!currentUser) {
         const { data } = await supabase.auth.getUser();
         currentUser = data?.user ?? null;
      }

      // 3. 🚀 NUKLEÁRNE ČÍTANIE: Ak Supabase blbne, vytrhneme si profil priamo z nášho Trezoru!
      if (!currentUser && typeof window !== "undefined") {
         try {
            let stored = window.localStorage.getItem("sr_vault_session");
            if (!stored) stored = window.localStorage.getItem("sr_vault_session_backup");
            if (stored) {
               const parsed = JSON.parse(stored);
               // Z tohto Supabase JSONu si priamo vytiahneme celé tvoje používateľské dáta (aj s menom)
               if (parsed?.user) currentUser = parsed.user;
            }
         } catch (e) {}
      }

      if (!mounted) return;

      setUser(currentUser);
      setLoading(false);

      if (redirectToLogin && !currentUser) {
        router.push("/signin");
      }
    }

    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (!mounted) return;
      
      if (session?.user) {
        setUser(session.user);
      } else if (_event === "SIGNED_OUT") {
        // Zmažeme stav IBO V PRÍPADE, že si naozaj ty klikol na tlačidlo Odhlásiť
        if (typeof window !== "undefined" && window.sessionStorage.getItem("explicit_logout") === "true") {
           setUser(null);
           if (redirectToLogin) router.push("/signin");
        }
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [redirectToLogin, router, supabase]);

  return { user, loading };
}