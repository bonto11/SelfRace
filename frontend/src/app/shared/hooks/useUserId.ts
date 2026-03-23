"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/app/shared/utils/supabaseBrowser";
import { callBackend } from "@/app/shared/utils/callBackend";

type WhoAmI = { id: number | null; uuid: string | null };

let globalResolvePromise: Promise<any> | null = null;

export function useUserId() {
  const router = useRouter();
  const pathname = usePathname();
  
  const [state, setState] = useState<WhoAmI>({ 
      id: typeof window !== "undefined" ? Number(window.localStorage.getItem("selfrace_numeric_id")) || null : null, 
      uuid: null 
  });
  const [isChecking, setIsChecking] = useState(true);
  
  // Zabraňuje double-renderu
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    let isMounted = true;

    const handleUser = async (sessionUser: any) => {
        if (!isMounted) return;

        if (!sessionUser) {
            // 🚨 ZÁCHRANNÝ ŠTÍT PRE STRAVU A STRIPE 🚨
            // Ak máme v URL OAuth parametre, Supabase ich práve teraz na pozadí spracováva.
            // NESMIEME používateľa presmerovať preč, inak ten proces zabijeme!
            const url = window.location.href;
            const isProcessingOAuth = url.includes("code=") || url.includes("access_token=") || url.includes("refresh_token=");
            
            const isPublicPage = pathname?.startsWith("/signin") || pathname?.startsWith("/signup") || pathname?.startsWith("/forgot-password");

            if (isProcessingOAuth) {
                console.log("⏳ [AUTH] Zistil som návrat zo Stravy/Stripe! Trpezlivo čakám...");
                return; // Neurobíme NIČ. Čakáme na event 'SIGNED_IN'.
            }

            // Až tu si môžeme byť istí, že user naozaj nie je prihlásený
            console.log("🔴 [AUTH] Žiadna session, mažem dáta a odhlasujem.");
            window.localStorage.removeItem("selfrace_numeric_id");
            setState({ id: null, uuid: null });
            setIsChecking(false);
            
            if (!isPublicPage) {
                router.replace("/signin");
            }
            return;
        }

        // ✅ Máme usera!
        console.log("🟢 [AUTH] Úspešné prihlásenie. UUID:", sessionUser.id);
        let numId: number | null = Number(window.localStorage.getItem("selfrace_numeric_id")) || null;

        if (!numId) {
            if (!globalResolvePromise) {
                globalResolvePromise = callBackend<{ success: boolean; user_id?: number }>("/users/resolve", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ auth_uid: sessionUser.id })
                });
            }
            try {
                const res = await globalResolvePromise;
                if (res?.success && res.user_id) {
                    numId = res.user_id;
                    window.localStorage.setItem("selfrace_numeric_id", String(numId));
                }
            } catch (e) {
                console.error("[AUTH] Backend resolve error:", e);
            } finally {
                globalResolvePromise = null;
            }
        }

        if (isMounted) {
            setState({ id: numId, uuid: sessionUser.id });
            setIsChecking(false);
        }
    };

    // 1. Získame počiatočný stav pri štarte (alebo po F5)
    supabase.auth.getSession().then(({ data }) => {
        handleUser(data.session?.user);
    });

    // 2. Event Listener - Toto chytí Stravu, keď sa kód úspešne vymení za session!
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: any) => {
        console.log("🔵 [AUTH EVENT]", event);
        if (event === "SIGNED_OUT") {
            handleUser(null);
        } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
            handleUser(session?.user);
        }
    });

    return () => {
        isMounted = false;
        subscription.unsubscribe();
    };
  }, [pathname, router]);

  return useMemo(() => ({
    userId: state.id,
    userUuid: state.uuid,
    isChecking,
    refresh: () => {
        setIsChecking(true);
        supabase.auth.getSession().then(() => {
            setTimeout(() => setIsChecking(false), 500); // Soft refresh UI
        });
    }
  }), [state.id, state.uuid, isChecking]);
}