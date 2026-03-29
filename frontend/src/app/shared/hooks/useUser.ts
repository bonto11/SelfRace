// src/app/shared/hooks/useUser.ts
"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

export function useUser(redirectToLogin: boolean = false) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = getSupabaseBrowser();

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      let { data: { session } } = await supabase.auth.getSession();
      
      if (!mounted) return;

      const backupAccess = typeof window !== "undefined" ? window.localStorage.getItem("sr_backup_access") : null;

      if (!session && backupAccess) {
         // Máme zálohu! Necháme loading na true a počkáme, kým to useUserId na pozadí oživí.
         // Dôležité: Nepresmerujeme ťa von!
         console.log("⏳ [useUser] Čakám na oživenie session zo zálohy...");
      } else {
         setUser(session?.user ?? null);
         setLoading(false);

         if (redirectToLogin && !session?.user) {
           router.push("/signin"); 
         }
      }
    }

    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        if (!mounted) return;
        
        setUser(session?.user ?? null);
        setLoading(false);
        
        if (redirectToLogin && !session?.user) {
           // Posledná poistka
           if (!window.localStorage.getItem("sr_backup_access")) {
               router.push("/signin");
           }
        }
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [redirectToLogin, router, supabase]);

  return { user, loading };
}
