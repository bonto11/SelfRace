"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { callBackend } from "@/app/shared/utils/callBackend";

type WhoAmI = { id: number | null; uuid: string | null };

let sharedResolvePromise: Promise<any> | null = null;
let sharedSessionPromise: Promise<any> | null = null; // Pridané pre deduplikáciu 20 widgetov!

export function useUserId() {
  const router = useRouter();
  const pathname = usePathname();
  
  // 🚀 HACK: Vytiahneme ID z LocalStorage HNEĎ a veríme mu.
  const storedId = typeof window !== "undefined" ? Number(window.localStorage.getItem("selfrace_numeric_id")) || null : null;
  const storedUuid = typeof window !== "undefined" ? window.localStorage.getItem("selfrace_uuid") : null;

  const [state, setState] = useState<WhoAmI>({ id: storedId, uuid: storedUuid });
  
  // Ak máme ID v LocalStorage, isChecking je okamžite false -> apka sa hneď vykreslí!
  const [isChecking, setIsChecking] = useState(storedId === null);

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseBrowser();

    const handleUser = async (sessionUser: any) => {
        if (!isMounted) return;

        if (!sessionUser) {
            // 🚨 TU JE TEN HACK: Ak nemáme sessionUser, ale máme LS, NEROBÍME NIČ!
            // Ignorujeme to. Supabase len nestihol načítať cookies/URL po redirecte.
            if (window.localStorage.getItem("selfrace_numeric_id")) {
                console.log("🛡️ [HACK] Supabase hlási null, ale v LS máme ID. Ignorujem odhlásenie.");
                return;
            }

            // Ak naozaj nemáme nič nikde, až vtedy presmerujeme
            const isPublicPage = pathname?.startsWith("/signin") || pathname?.startsWith("/signup") || pathname?.startsWith("/forgot-password");
            if (!isPublicPage) {
                router.replace("/signin");
            }
            setIsChecking(false);
            return;
        }

        // Ak Supabase našiel usera, zapíšeme si ho (alebo overíme na backende)
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
                const res = await sharedResolvePromise!;
                if (res?.success && res.user_id) {
                    numId = res.user_id;
                    window.localStorage.setItem("selfrace_numeric_id", String(numId));
                    window.localStorage.setItem("selfrace_uuid", sessionUser.id);
                }
            } catch (e) {
                console.warn("[AUTH] Backend resolve error:", e);
            }
        } else {
            // Poistka: zapíšeme aj UUID pre rýchlejšie ďalšie načítania
            window.localStorage.setItem("selfrace_uuid", sessionUser.id);
        }

        if (isMounted) {
            setState({ id: numId, uuid: sessionUser.id });
            setIsChecking(false);
        }
    };

    // Deduplikované pýtanie si session, aby 20 widgetov nezabilo pamäť
    if (!sharedSessionPromise) {
        sharedSessionPromise = supabase.auth.getSession();
        setTimeout(() => { sharedSessionPromise = null; }, 1000);
    }

    sharedSessionPromise?.then(({ data }: any) => {
        handleUser(data?.session?.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: any) => {
        // Ignorujeme INITIAL_SESSION, to sme si vyriešili cez deduplikované getSession hore
        if (event === "INITIAL_SESSION") return;
        
        // Tieto eventy len updatujú stav do plusu, nikdy nás nasilu neodhlasujú z hacku
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
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
        setIsChecking(false);
    }
  }), [state.id, state.uuid, isChecking]);
}