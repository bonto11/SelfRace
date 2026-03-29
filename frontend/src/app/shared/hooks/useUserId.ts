"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { callBackend } from "@/app/shared/utils/callBackend";

type WhoAmI = { id: number | null; uuid: string | null };

export function useUserId() {
  const router = useRouter();
  const pathname = usePathname();

  const [state, setState] = useState<WhoAmI>({
    id: typeof window !== "undefined" ? Number(window.localStorage.getItem("selfrace_numeric_id")) || null : null,
    uuid: typeof window !== "undefined" ? window.localStorage.getItem("selfrace_uuid") : null
  });
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseBrowser();

    const resolveUser = async () => {
      try {
        console.log("[AUTH] Kontrolujem session...");
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) console.error("[AUTH] Chyba session:", error);

        const user = session?.user;

        if (!user) {
          console.log("[AUTH] Užívateľ nenájdený. Mažem lokálne dáta.");
          window.localStorage.removeItem("selfrace_numeric_id");
          window.localStorage.removeItem("selfrace_uuid");
          if (isMounted) {
            setState({ id: null, uuid: null });
            setIsChecking(false);
          }

          const isPublicPage = pathname?.startsWith("/signin") || pathname?.startsWith("/signup") || pathname?.startsWith("/forgot-password");
          if (!isPublicPage) {
              console.log("[AUTH] Presmerovávam na /signin");
              router.replace("/signin");
          }
          return;
        }

        console.log("[AUTH] Supabase User UUID:", user.id);
        let numId = Number(window.localStorage.getItem("selfrace_numeric_id")) || null;

        if (!numId) {
          console.log("[AUTH] Chýba numeric_id, volám backend na /users/resolve...");
          try {
            const res = await callBackend<{ success: boolean; user_id?: number }>("/users/resolve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ auth_uid: user.id })
            });
            console.log("[AUTH] Odpoveď z resolve:", res);

            if (res?.success && res.user_id) {
                numId = res.user_id;
                window.localStorage.setItem("selfrace_numeric_id", String(numId));
                window.localStorage.setItem("selfrace_uuid", user.id);
            } else {
                console.warn("[AUTH] Backend nevrátil user_id!");
            }
          } catch (e) {
            console.error("[AUTH] Zlyhal request na resolve:", e);
          }
        } else {
           window.localStorage.setItem("selfrace_uuid", user.id);
        }

        if (isMounted) {
          console.log("[AUTH] Finálny stav -> numeric_id:", numId);
          setState({ id: numId, uuid: user.id });
          setIsChecking(false);
        }

      } catch (e) {
         console.error("[AUTH] Nečakaná chyba v resolveUser:", e);
         if (isMounted) setIsChecking(false);
      }
    };

    resolveUser();

    // ✅ OPRAVA: Pridané typy (event: string, session: any)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: any) => {
        console.log(`[AUTH] Event zmeny stavu: ${event}`);
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "SIGNED_OUT") {
            resolveUser();
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
        getSupabaseBrowser().auth.getSession().then(() => setIsChecking(false));
    }
  }), [state.id, state.uuid, isChecking]);
}
