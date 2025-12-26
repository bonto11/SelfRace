"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { useRouter } from "next/navigation";

export function useUser(redirectToLogin: boolean = false) {
  const [user, setUser] = useState<any>(null); // user bude auth user (UUID)
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = getSupabaseBrowser();

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user ?? null);
      setLoading(false);

      if (redirectToLogin && !user) {
        router.push("/signin");
      }
    }

    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        if (redirectToLogin && !session?.user) {
          router.push("/signin");
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [redirectToLogin, router]);

  return { user, loading };
}
