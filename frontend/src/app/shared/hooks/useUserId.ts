"use client";

import { useState, useEffect, useMemo } from "react";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { callBackend } from "@/app/shared/utils/callBackend";

type WhoAmI = { id: number | null; uuid: string | null };

export function useUserId() {
  const [state, setState] = useState<WhoAmI>({
    id: typeof window !== "undefined" ? Number(window.localStorage.getItem("selfrace_numeric_id")) || null : null,
    uuid: typeof window !== "undefined" ? window.localStorage.getItem("selfrace_uuid") : null
  });
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseBrowser();

    const resolveUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) {
        window.localStorage.removeItem("selfrace_numeric_id");
        window.localStorage.removeItem("selfrace_uuid");
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
              body: JSON.stringify({ auth_uid: user.id })
          });
          if (res?.success && res.user_id) {
              numId = res.user_id;
              window.localStorage.setItem("selfrace_numeric_id", String(numId));
          }
        } catch (e) {
          console.warn("[AUTH] Chyba pri resolvingu user_id", e);
        }
      }

      window.localStorage.setItem("selfrace_uuid", user.id);

      if (isMounted) {
        setState({ id: numId, uuid: user.id });
        setIsChecking(false);
      }
    };

    resolveUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => resolveUser());

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