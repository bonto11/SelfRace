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

      // 1. Skúsime cez Supabase (automaticky volá async IndexedDB adaptér)
      const { data: { session } } = await supabase.auth.getSession();
      currentUser = session?.user ?? null;

      // 2. Ak Supabase blbne, na pozadí ho predbehneme nukleárnym čítaním priamo z DB
      if (!currentUser && typeof window !== "undefined") {
         try {
            const idbKeyval = await import('idb-keyval'); // Dynamic import pre menší bundle
            const stored = await idbKeyval.get("sr_vault_stable"); // Async hľadanie v DB
            if (stored) {
               const parsed = JSON.parse(stored);
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

    // ✅ Zmrazené odhlasovanie: Ak sa stav zmení na null bez logout flagu, nič nerobíme
    const { data: listener } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (!mounted) return;
      
      if (session?.user) {
        setUser(session.user);
      } else if (_event === "SIGNED_OUT") {
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