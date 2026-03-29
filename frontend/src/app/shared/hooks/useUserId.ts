"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { callBackend } from "@/app/shared/utils/callBackend";

type WhoAmI = { id: number | null; uuid: string | null };

let sharedResolvePromise: Promise<any> | null = null;
let sharedSessionPromise: Promise<any> | null = null;

export function useUserId() {
  const router = useRouter();
  const pathname = usePathname();
  
  const storedId = typeof window !== "undefined" ? Number(window.localStorage.getItem("selfrace_numeric_id")) || null : null;
  const storedUuid = typeof window !== "undefined" ? window.localStorage.getItem("selfrace_uuid") : null;

  const [state, setState] = useState<WhoAmI>({ id: storedId, uuid: storedUuid });
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseBrowser();

    const handleUser = async (sessionUser: any) => {
        if (!isMounted) return;

        if (!sessionUser) {
            // Unauthenticated state
            window.localStorage.removeItem("selfrace_numeric_id");
            window.localStorage.removeItem("selfrace_uuid");
            setState({ id: null, uuid: null });
            setIsChecking(false);
            
            const isPublicPage = pathname?.startsWith("/signin") || pathname?.startsWith("/signup") || pathname?.startsWith("/forgot-password");
            
            // Allow code redirects for auth flows (like Strava) to proceed before redirecting
            const url = window.location.href;
            const isAuthCallback = url.includes("code=") || url.includes("access_token=") || url.includes("refresh_token=");

            if (!isPublicPage && !isAuthCallback) {
                router.replace("/signin");
            }
            return;
        }

        // Authenticated state - resolve numeric ID if missing
        let numId: number | null = Number(window.localStorage.getItem("selfrace_numeric_id")) || null;

        if (!numId) {
            if (!sharedResolvePromise) {
                sharedResolvePromise = callBackend<{ success: boolean; user_id?: number }>("/users/resolve", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ auth_uid: sessionUser.id })
                });
                // Simple cache to prevent duplicate rapid calls
                setTimeout(() => { sharedResolvePromise = null; }, 1000); 
            }
            
            try {
                const res = await sharedResolvePromise!;
                if (res?.success && res.user_id) {
                    numId = res.user_id;
                    window.localStorage.setItem("selfrace_numeric_id", String(numId));
                    window.localStorage.setItem("selfrace_uuid", sessionUser.id);
                }
            } catch (e) {
                console.error("[AUTH] Backend resolve error:", e);
            }
        } else {
             // Ensure UUID is synced if numeric ID existed
            window.localStorage.setItem("selfrace_uuid", sessionUser.id);
        }

        if (isMounted) {
            setState({ id: numId, uuid: sessionUser.id });
            setIsChecking(false);
        }
    };

    // Initial check
    if (!sharedSessionPromise) {
        sharedSessionPromise = supabase.auth.getSession();
        setTimeout(() => { sharedSessionPromise = null; }, 1000);
    }

    sharedSessionPromise?.then(({ data }: any) => {
        handleUser(data?.session?.user);
    });

    // Listen for changes
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
        getSupabaseBrowser().auth.getSession().then(() => {
            setTimeout(() => setIsChecking(false), 500);
        });
    }
  }), [state.id, state.uuid, isChecking]);
}
