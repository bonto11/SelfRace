"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { callBackend } from "@/app/shared/utils/callBackend";

type WhoAmI = { id: number | null; uuid: string | null };

let globalResolvePromise: Promise<any> | null = null;

export function useUserId() {
  const [state, setState] = useState<WhoAmI>({ id: null, uuid: null });
  const [isChecking, setIsChecking] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  
  // Ochrana proti double-renderu v Next.js
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const supabase = getSupabaseBrowser();

    const resolveUser = async (session: any) => {
        // 1. Zlyhala session (napr. po F5 alebo pri prvom načítaní)?
        if (!session) {
            // 🚨 ZÁCHRANNÁ BRZDA PRE STRAVU A STRIPE 🚨
            // Ak je v URL kód, znamená to, že sa vraciame z externej služby.
            // Nesmieme presmerovať na /signin, musíme počkať na event 'SIGNED_IN' zo Supabase!
            const isAuthRedirect = window.location.hash.includes("access_token") || window.location.search.includes("code=");
            if (isAuthRedirect) {
                console.log("⏳ [AUTH] Návrat zo Stravy/Stripe! Čakám na spracovanie...");
                return; 
            }

            console.log("❌ [AUTH] Žiadna session. Odhlasujem.");
            window.localStorage.removeItem("selfrace_numeric_id");
            setState({ id: null, uuid: null });
            setIsChecking(false);

            // Odhlásenie bez cyklenia
            const isPublic = pathname?.startsWith("/signin") || pathname?.startsWith("/signup") || pathname?.startsWith("/forgot-password");
            if (!isPublic) {
                router.replace("/signin");
            }
            return;
        }

        // 2. MÁME SESSION!
        console.log("✅ [AUTH] Session existuje pre UUID:", session.user.id);
        const uuid = session.user.id;
        let numId = Number(window.localStorage.getItem("selfrace_numeric_id")) || null;

        // Vypýtame si ID z nášho Python backendu
        if (!numId) {
            if (!globalResolvePromise) {
                globalResolvePromise = callBackend<{ success: boolean; user_id?: number }>("/users/resolve", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ auth_uid: uuid })
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

        setState({ id: numId, uuid });
        setIsChecking(false);
    };

    // A. Kontrola pri naštartovaní aplikácie (alebo po F5)
    supabase.auth.getSession().then(({ data }) => {
        resolveUser(data.session);
    });

    // B. Listener, ktorý čaká na prihlásenie (napr. keď Strava vráti token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        console.log("🔔 [AUTH EVENT]", event);
        if (event === "SIGNED_OUT") {
            window.localStorage.removeItem("selfrace_numeric_id");
            setState({ id: null, uuid: null });
            setIsChecking(false);
            router.replace("/signin");
        } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
            resolveUser(session);
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
        getSupabaseBrowser().auth.getSession().then(({ data }) => {
            // Len vizuálny reset načítavania
            setTimeout(() => setIsChecking(false), 500);
        });
    }
  }), [state.id, state.uuid, isChecking]);
}