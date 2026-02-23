// src/shared/hooks/useUser.ts
"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js"; // ✅ Pridané typy

export function useUser(redirectToLogin: boolean = false) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = getSupabaseBrowser();

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!mounted) return;

      setUser(session?.user ?? null);
      setLoading(false);

      if (redirectToLogin && !session?.user) {
        router.push("/");
      }
    }

    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange(
      // ✅ Explicitne pridané typy, aby TypeScript nehlásil chybu ts(7006)
      (_event: AuthChangeEvent, session: Session | null) => {
        if (!mounted) return;
        setUser(session?.user ?? null);
        
        if (redirectToLogin && !session?.user && !loading) {
          router.push("/");
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