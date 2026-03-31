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
    let redirectTimer: NodeJS.Timeout;

    async function loadUser() {
      let { data: { session } } = await supabase.auth.getSession();
      
      // 🛡️ ANTI-PANIKOVÝ HACK PRI ŠTARTE: Počkáme 800ms (čas pre iPhone)
      if (!session?.user) {
        await new Promise((res) => setTimeout(res, 800));
        const retry = await supabase.auth.getSession();
        session = retry.data.session;
      }

      if (!mounted) return;

      setUser(session?.user ?? null);
      setLoading(false);

      if (redirectToLogin && !session?.user) {
        router.push("/signin");
      }
    }

    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (!mounted) return;

      if (redirectToLogin && !session?.user) {
        // 🛡️ ANTI-PANIKOVÝ HACK PRI ZMENE STAVU: Neodhlásime ťa hneď, najprv overíme
        redirectTimer = setTimeout(async () => {
          const { data } = await supabase.auth.getSession();
          if (!mounted) return;
          
          if (!data.session?.user) {
            setUser(null);
            router.push("/signin");
          } else {
            console.log("[HACK] Falošný poplach ignorovaný, token na iPhone prežil!");
            setUser(data.session.user);
          }
        }, 800);
      } else {
        clearTimeout(redirectTimer);
        setUser(session?.user ?? null);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(redirectTimer);
      listener.subscription.unsubscribe();
    };
  }, [redirectToLogin, router, supabase]);

  return { user, loading };
}