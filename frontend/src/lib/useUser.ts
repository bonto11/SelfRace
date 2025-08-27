// src/lib/useUser.ts
"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { useRouter } from "next/navigation";

export function useUser(redirectToLogin: boolean = false) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user ?? null);
      setLoading(false);

      if (redirectToLogin && !user) {
        router.push("/login");
      }
    }

    loadUser();

    // počúvaj zmeny
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        if (redirectToLogin && !session?.user) {
          router.push("/login");
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [redirectToLogin, router]);

  return { user, loading };
}
