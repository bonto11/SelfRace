"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { callBackend } from "@/app/shared/utils/callBackend";

type WhoAmI = { id: number | null; uuid: string | null };

let globalResolvePromise: Promise<any> | null = null;

export function useUserId() {
  const [state, setState] = useState<WhoAmI>({ 
      id: typeof window !== "undefined" ? Number(window.localStorage.getItem("selfrace_numeric_id")) || null : null, 
      uuid: null 
  });
  const [isChecking, setIsChecking] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const hasFetched = useRef(false);

  useEffect(() => { 
    if (hasFetched.current) return;
    hasFetched.current = true;

    const supabase = getSupabaseBrowser();
    
    const loadUser = async () => {
        // Ak sa vraciame z externej služby, v URL je hash alebo kód.
        // Musíme dať Supabase aspoň sekundu čas, aby to spracoval, inak to okamžité presmerovanie zmaže!
        if (typeof window !== "undefined" && (window.location.href.includes('code=') || window.location.href.includes('access_token='))) {
            console.log("[AUTH DEBUG] Návrat zo Stravy/Stripe! Čakám na spracovanie URL...");
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const { data: { session } } = await supabase.auth.getSession();

        // Ak naozaj session nemáme (už to preskúmal)
        if (!session?.user) {
            console.log("[AUTH DEBUG] Ziadna session. Presmerovávam na prihlásenie.");
            if (typeof window !== "undefined") window.localStorage.removeItem("selfrace_numeric_id");
            setState({ id: null, uuid: null });
            setIsChecking(false);
            
            if (pathname && !pathname.startsWith("/signin") && !pathname.startsWith("/signup") && !pathname.startsWith("/forgot-password")) {
                router.replace("/signin");
            }
            return;
        }

        // Session existuje! Pokračujeme.
        const uuid = session.user.id;
        let numericId: number | null = Number(window.localStorage.getItem("selfrace_numeric_id")) || null;

        if (!numericId) {
            if (!globalResolvePromise) {
               globalResolvePromise = callBackend<{ success: boolean; user_id?: number }>("/users/resolve", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ auth_uid: uuid })
               });
            }
            try {
              const res = await globalResolvePromise;
              // ✅ OPRAVA PRVEJ CHYBY (numericId is possibly null)
              if (res?.success && res.user_id) {
                  numericId = res.user_id;
                  // Tu sme si istí, že numericId je číslo, môžeme použiť String()
                  window.localStorage.setItem("selfrace_numeric_id", String(numericId));
              }
            } catch (e) {
              console.error("[AUTH DEBUG] Chyba pri callBackend:", e);
            } finally {
              globalResolvePromise = null;
            }
        }

        setState({ id: numericId, uuid });
        setIsChecking(false);
    };

    // Spustíme prvotnú kontrolu
    loadUser();

    // ✅ OPRAVA DRUHEJ CHYBY (event implicitly has any type)
    // Pridali sme "event: string"
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string) => {
       console.log("[AUTH DEBUG] Auth event:", event);
       if (event === 'SIGNED_OUT') {
           window.localStorage.removeItem("selfrace_numeric_id");
           setState({ id: null, uuid: null });
           router.replace("/signin");
       } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
           loadUser();
       }
    });

    return () => subscription.unsubscribe();
  }, [pathname, router]);

  return useMemo(() => ({ 
    userId: state.id, 
    userUuid: state.uuid, 
    isChecking,
    refresh: () => {
      setIsChecking(true);
      hasFetched.current = false; // Vynúti re-run pri ručnom refreshi
    }
  }), [state.id, state.uuid, isChecking]);
}