"use client";

import { useState, useEffect, useMemo } from "react";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { callBackend } from "@/app/shared/utils/callBackend";

type WhoAmI = { id: number | null; uuid: string | null };

export function useUserId() {
  const [state, setState] = useState<WhoAmI>({ id: null, uuid: null });
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseBrowser();

    const resolveUser = async () => {
      let { data: { session } } = await supabase.auth.getSession();
      
      // 🛡️ ANTI-PANIKOVÝ HACK: Ak je session null, počkáme 200ms a skúsime znova
      if (!session?.user) {
        await new Promise((res) => setTimeout(res, 200));
        const retry = await supabase.auth.getSession();
        session = retry.data.session;
      }

      const currentUser = session?.user ?? null;

      if (!currentUser) {
        if (isMounted) {
          setState({ id: null, uuid: null });
          setIsChecking(false);
        }
        return;
      }

      let numId = Number(window.localStorage.getItem("selfrace_numeric_id")) || null;

      if (!numId) {
        try {
          const res = await callBackend<{ success: boolean; user_id?: number }>("/users/resolve", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ auth_uid: currentUser.id })
          });
          if (res?.success && res.user_id) {
              numId = res.user_id;
              window.localStorage.setItem("selfrace_numeric_id", String(numId));
          }
        } catch (e) {}
      }

      if (isMounted) {
        setState({ id: numId, uuid: currentUser.id });
        setIsChecking(false);
      }
    };

    resolveUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any) => {
       if (_event !== "INITIAL_SESSION") resolveUser();
    });

    return () => {
        isMounted = false;
        subscription.unsubscribe();
    };
  }, []);

  return useMemo(() => ({
    userId: state.id,
    userUuid: state.uuid,
    isChecking,
    refresh: () => setIsChecking(false)
  }), [state.id, state.uuid, isChecking]);
}