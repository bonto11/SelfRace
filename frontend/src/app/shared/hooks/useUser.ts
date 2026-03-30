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

      const { data: { session } } = await supabase.auth.getSession();
      currentUser = session?.user ?? null;

      if (!currentUser) {
         const { data } = await supabase.auth.getUser();
         currentUser = data?.user ?? null;
      }

      // 🚀 NUKLEÁRNE ČÍTANIE (LocalStorage + Cookie pre Apple PWA)
      if (!currentUser && typeof window !== "undefined") {
         try {
            let stored = window.localStorage.getItem("sr_vault_session");
            if (!stored) stored = window.localStorage.getItem("sr_vault_session_backup");
            
            // 🍏 Kryptonit na Apple: Ak LS zlyhá, hľadáme v Cookie
            if (!stored) {
               const match = document.cookie.match(new RegExp('(^| )sr_vault_cookie=([^;]+)'));
               if (match) stored = decodeURIComponent(match[2]);
            }

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