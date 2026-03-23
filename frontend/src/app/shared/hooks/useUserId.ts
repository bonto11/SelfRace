"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
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
    const supabase = getSupabaseBrowser();

    const handleUser = async (sessionUser: any) => {
        if (!isMounted) return;

        if (!sessionUser) {
            // Sme si 100% istí, že user nemá session (LocalStorage bol naozaj prázdny)
            
            // Ochrana pred zmazaním počas návratu zo Stravy/Stripe
            const url = window.location.href;
            if (url.includes("code=") || url.includes("access_token=") || url.includes("refresh_token=")) {
                console.log("⏳ [AUTH] Zistil som návrat zo Stravy/Stripe! Trpezlivo čakám...");
                return;
            }

            console.log("🔴 [AUTH] Naozaj žiadna session, mažem dáta a odhlasujem.");
            window.localStorage.removeItem("selfrace_numeric_id");
            setState({ id: null, uuid: null });
            setIsChecking(false);
            
            const isPublicPage = pathname?.startsWith("/signin") || pathname?.startsWith("/signup") || pathname?.startsWith("/forgot-password");
            if (!isPublicPage) {
                router.replace("/signin");
            }
            return;
        }

        // ✅ Máme usera! (Token prežil F5)
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

    // ✅ TOTO JE TA MAGICKÁ OPRAVA:
    // Už sa nepýtame cez getSession(). Iba čakáme, kým nám Supabase sám povie, že prečítal storage.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: any) => {
        console.log(`🔵 [AUTH EVENT] ${event}`, "Session exists?", !!session);
        
        if (event === "SIGNED_OUT") {
            handleUser(null);
        } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
            // INITIAL_SESSION vystrelí raz, hneď ako Supabase bezpečne načíta token z LocalStorage.
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
        getSupabaseBrowser().auth.getSession().then(() => {
            setTimeout(() => setIsChecking(false), 500);
        });
    }
  }), [state.id, state.uuid, isChecking]);
}