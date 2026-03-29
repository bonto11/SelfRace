// src/shared/hooks/useUser.ts
"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

export function useUser(redirectToLogin: boolean = false) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  
  // Nespoliehame sa len na hook dependency, udržíme si referenciu
  const supabase = getSupabaseBrowser();

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      let { data: { session } } = await supabase.auth.getSession();
      
      // 🔥 PARTIZÁNSKA KONTROLA: Skôr než spanikárime, pozrieme sa, či nemáme zálohu
      if (!session && typeof window !== "undefined") {
        const backupAccess = window.localStorage.getItem("sr_backup_access");
        if (backupAccess) {
           // Zatiaľ nebudeme presmerovávať, lebo vieme, že useUserId sa to práve
           // snaží na pozadí oživiť. Dáme mu čas.
           return; 
        }
      }

      if (!mounted) return;

      setUser(session?.user ?? null);
      setLoading(false);

      if (redirectToLogin && !session?.user) {
        // Zmenil som z "/" na "/signin", lebo to je asi tvoja prihlasovacia stránka
        router.push("/signin"); 
      }
    }

    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        if (!mounted) return;
        
        setUser(session?.user ?? null);
        
        // Pri evente už rovno reagujeme
        if (redirectToLogin && !session?.user && !loading) {
           // Opäť poistka voči falošným odhláseniam
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
  }, [redirectToLogin, router, loading, supabase]);

  return { user, loading };
}
