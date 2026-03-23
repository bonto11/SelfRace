"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { callBackend } from "@/app/shared/utils/callBackend";

type WhoAmI = { id: number | null; uuid: string | null };

// Zámky na zabránenie strieľania 20 backend requestov po F5
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

        if (!sessionUser) {
            // Sme naozaj odhlásení? Počkáme, či to nie je Strava/Stripe návrat.
            const url = window.location.href;
            if (url.includes("code=") || url.includes("access_token=") || url.includes("refresh_token=")) {
                return; // Sme v OAuth procese, čakáme.
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

        // Máme Token z LocalStorage! Získame ID.
        let numId: number | null = Number(window.localStorage.getItem("selfrace_numeric_id")) || null;

        if (!numId) {
            if (!sharedResolvePromise) {
                sharedResolvePromise = callBackend<{ success: boolean; user_id?: number }>("/users/resolve", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ auth_uid: sessionUser.id })
                });
                setTimeout(() => { sharedResolvePromise = null; }, 1000);
            }
            
            try {
                const res = await sharedResolvePromise;
                if (res?.success && res.user_id) {
                    numId = res.user_id;
                    window.localStorage.setItem("selfrace_numeric_id", String(numId));
                }
            } catch (e) {
                console.error("[AUTH] Backend error:", e);
            }
        }

        if (isMounted) {
            setState({ id: numId, uuid: sessionUser.id });
            setIsChecking(false);
        }
    };

    // 1. Spoločné načítanie Session z LocalStorage (jeden request pre celú appku)
    if (!sharedSessionPromise) {
        sharedSessionPromise = supabase.auth.getSession();
        setTimeout(() => { sharedSessionPromise = null; }, 1000);
    }

    sharedSessionPromise.then(({ data }) => {
        handleUser(data.session?.user);
    });

    // 2. Počúvame zmeny (napríklad úspešný návrat zo Stravy)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: any) => {
        if (event === "INITIAL_SESSION") return; 
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