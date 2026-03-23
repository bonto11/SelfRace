"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { callBackend } from "@/app/shared/utils/callBackend";

type WhoAmI = { id: number | null; uuid: string | null };

// 🛡️ GLOBÁLNE ZÁMKY (Deduplikácia pre všetkých 20 widgetov)
// Ak sa 20 widgetov pýta naraz, vytvorí sa len JEDEN request. Ostatní čakajú na ten istý.
let sharedSessionPromise: Promise<any> | null = null;
let sharedResolvePromise: Promise<any> | null = null;

export function useUserId() {
  const router = useRouter();
  const pathname = usePathname();
  
  const [state, setState] = useState<WhoAmI>({ 
      id: typeof window !== "undefined" ? Number(window.localStorage.getItem("selfrace_numeric_id")) || null : null, 
      uuid: null 
  });
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseBrowser();

    const handleUser = async (sessionUser: any) => {
        if (!isMounted) return;

        // 1. Ak nie sme prihlásení
        if (!sessionUser) {
            // Ochrana Stravy / Stripe
            const url = window.location.href;
            if (url.includes("code=") || url.includes("access_token=") || url.includes("refresh_token=")) {
                return; // Sme v OAuth procese, nič nemažeme
            }

            window.localStorage.removeItem("selfrace_numeric_id");
            setState({ id: null, uuid: null });
            setIsChecking(false);
            
            const isPublicPage = pathname?.startsWith("/signin") || pathname?.startsWith("/signup") || pathname?.startsWith("/forgot-password");
            if (!isPublicPage) {
                router.replace("/signin");
            }
            return;
        }

        // 2. Sme prihlásení, ideme získať naše číselné ID (s deduplikáciou!)
        let numId: number | null = Number(window.localStorage.getItem("selfrace_numeric_id")) || null;

        if (!numId) {
            // Ak sa 20 widgetov dostane sem, len PRVÝ vytvorí backend request
            if (!sharedResolvePromise) {
                sharedResolvePromise = callBackend<{ success: boolean; user_id?: number }>("/users/resolve", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ auth_uid: sessionUser.id })
                });

                // Vyčistíme zámok po sekunde, aby neskoršie refreshe nebrali starú cache
                setTimeout(() => { sharedResolvePromise = null; }, 1000);
            }
            
            try {
                const res = await sharedResolvePromise; // Všetci čakajú na 1 request
                if (res?.success && res.user_id) {
                    numId = res.user_id;
                    window.localStorage.setItem("selfrace_numeric_id", String(numId));
                }
            } catch (e) {
                console.error("[AUTH] Backend resolve error:", e);
            }
        }

        if (isMounted) {
            setState({ id: numId, uuid: sessionUser.id });
            setIsChecking(false);
        }
    };

    // ✅ DEDUPLIKOVANÁ KONTROLA SUPABASE SESSION (Riešenie tvojho nápadu)
    // Miesto toho aby sa 20 widgetov pýtalo Supabase disku, spýta sa len prvý.
    if (!sharedSessionPromise) {
        sharedSessionPromise = supabase.auth.getSession();
        setTimeout(() => { sharedSessionPromise = null; }, 1000); // Reset zámku
    }

    // Všetkých 20 widgetov čaká na jeden spoločný výsledok z disku
    sharedSessionPromise.then(({ data }) => {
        handleUser(data.session?.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: any) => {
        if (event === "INITIAL_SESSION") return; // Ignorujeme, toto už rieši náš zámok vyššie
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
        getSupabaseBrowser().auth.getSession().then(({ data }) => {
            setTimeout(() => setIsChecking(false), 500);
        });
    }
  }), [state.id, state.uuid, isChecking]);
}