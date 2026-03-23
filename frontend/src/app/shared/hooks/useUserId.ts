"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { callBackend } from "@/app/shared/utils/callBackend";

type WhoAmI = { id: number | null; uuid: string | null };

let globalResolvePromise: Promise<any> | null = null;

function getStoredId(): number | null {
   if (typeof window === "undefined") return null;
   const stored = window.localStorage.getItem("selfrace_numeric_id");
   return stored ? Number(stored) : null;
}

export function useUserId() {
  const [state, setState] = useState<WhoAmI>({ id: getStoredId(), uuid: null });
  const [isChecking, setIsChecking] = useState(true); // ✅ Zastaví paniku po refreshi
  const router = useRouter();
  const pathname = usePathname();
  const hasFetched = useRef(false);

  const resolveUser = useCallback(async (sessionUser: any, force = false) => {
    if (!sessionUser) {
      if (typeof window !== "undefined") window.localStorage.removeItem("selfrace_numeric_id");
      setState({ id: null, uuid: null });
      setIsChecking(false);
      
      if (pathname && !pathname.startsWith("/signin") && !pathname.startsWith("/signup") && !pathname.startsWith("/forgot-password")) {
          router.replace("/signin");
      }
      return;
    }

    if (!force && state.id && state.uuid === sessionUser.id) {
       setIsChecking(false);
       return;
    }

    if (!globalResolvePromise || force) {
       globalResolvePromise = callBackend<{ success: boolean; user_id?: number }>("/users/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ auth_uid: sessionUser.id })
       });
    }

    try {
      const res = await globalResolvePromise;
      setTimeout(() => { globalResolvePromise = null; }, 100);

      const numId = res?.success ? res.user_id : null;
      if (numId && typeof window !== "undefined") {
         window.localStorage.setItem("selfrace_numeric_id", numId.toString());
         setState({ id: numId, uuid: sessionUser.id });
      } else {
         setState(s => ({ ...s, uuid: sessionUser.id }));
      }
    } catch (e) {
      globalResolvePromise = null;
      setState(s => ({ ...s, uuid: "error" }));
    } finally {
      setIsChecking(false);
    }
  }, [state.id, state.uuid, pathname, router]);

  useEffect(() => { 
    if (hasFetched.current) return;
    hasFetched.current = true;

    const supabase = getSupabaseBrowser();
    
    supabase.auth.getSession().then(({ data: { session } }) => {
       resolveUser(session?.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
       if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
           resolveUser(session?.user);
       }
    });

    return () => subscription.unsubscribe();
  }, [resolveUser]);

  return useMemo(() => ({ 
    userId: state.id, 
    userUuid: state.uuid === "error" ? null : state.uuid, 
    isChecking, // Exportujeme info, či ešte len načítavame
    refresh: () => {
      setIsChecking(true);
      const supabase = getSupabaseBrowser();
      supabase.auth.getSession().then(({ data: { session } }) => resolveUser(session?.user, true));
    }
  }), [state.id, state.uuid, isChecking, resolveUser]);
}