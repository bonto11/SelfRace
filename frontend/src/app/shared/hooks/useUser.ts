"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { useRouter, usePathname } from "next/navigation";

export function useUser(redirectToLogin: boolean = false) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = getSupabaseBrowser();

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;

      setUser(session?.user ?? null);
      setLoading(false);

      if (redirectToLogin && !session?.user) {
        const hasBackup = window.localStorage.getItem("sr_vault_session_backup");
        if (!hasBackup && pathname !== "/signin") router.push("/signin");
      }
    }

    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      if (redirectToLogin && !session?.user) {
         const hasBackup = window.localStorage.getItem("sr_vault_session_backup");
         if (!hasBackup && pathname !== "/signin") router.push("/signin");
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [redirectToLogin, router, pathname, supabase]);

  return { user, loading };
}