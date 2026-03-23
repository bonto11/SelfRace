"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { callBackend } from "@/app/shared/utils/callBackend";

type WhoAmI = { id: number | null; uuid: string | null };

// GLOBÁLNA PREMENNÁ (Singleton): Zabezpečí, že ak 20 komponentov zavolá hook naraz,
// na backend sa pošle len jeden jediný sieťový dotaz. Ostatní si počkajú.
let globalResolvePromise: Promise<any> | null = null;

function getStoredId(): number | null {
   if (typeof window === "undefined") return null;
   const stored = window.localStorage.getItem("selfrace_numeric_id");
   return stored ? Number(stored) : null;
}

export function useUserId() {
  const [state, setState] = useState<WhoAmI>({ id: getStoredId(), uuid: null });
  const router = useRouter();
  const pathname = usePathname();
  
  // Zabraňuje slučke: Zaručí, že fetchUser sa v rámci tohto komponentu spustí len RAZ
  const hasFetched = useRef(false);

  const fetchUser = useCallback(async (force = false) => {
    try {
      const supabase = getSupabaseBrowser();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      // 1. KONTROLA: Máme vôbec platný token v prehliadači?
      if (sessionError || !session?.user) {
        if (typeof window !== "undefined") window.localStorage.removeItem("selfrace_numeric_id");
        setState({ id: null, uuid: null });
        
        // Kompromis: Ak nie sme na prihlasovacej stránke, presmerujeme. Zabraňuje cykleniu!
        if (pathname && !pathname.startsWith("/signin") && !pathname.startsWith("/signup") && !pathname.startsWith("/forgot-password")) {
            router.replace("/signin");
        }
        return;
      }

      // Ak už máme ID z tohto state-u, neotravujeme znova backend
      if (!force && state.id && state.uuid === session.user.id) {
         return;
      }

      // Ak iný komponent už medzičasom spustil dotaz, napojíme sa naň (nevyrobíme nový)
      if (!globalResolvePromise || force) {
         globalResolvePromise = callBackend<{ success: boolean; user_id?: number }>("/users/resolve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ auth_uid: session.user.id })
         });
      }

      const res = await globalResolvePromise;

      // Po chvíli vyčistíme promise cache, aby neskoršie manuálne refreshe prešli na backend
      setTimeout(() => { globalResolvePromise = null; }, 100);

      const numId = res?.success ? res.user_id : null;

      if (numId && typeof window !== "undefined") {
         window.localStorage.setItem("selfrace_numeric_id", numId.toString());
         setState({ id: numId, uuid: session.user.id });
      } else {
         // Backend vrátil chybu (napr. databáza spadla), ale token máme dobrý
         setState(s => ({ ...s, uuid: session.user.id }));
      }
    } catch (e) {
      console.error("[AUTH: useUserId] 💥 Error in fetchUser:", e);
      globalResolvePromise = null;
      setState(s => ({ ...s, uuid: "error" }));
    }
  }, [state.id, state.uuid, router, pathname]);

  useEffect(() => { 
    if (!hasFetched.current) {
       hasFetched.current = true;
       fetchUser(); 
    }
  }, [fetchUser]);

  return useMemo(() => ({ 
    userId: state.id, 
    // Ak sa backend neozýva, tvárime sa, že uuid je null, ale vnútorne vieme, že sme to už skúsili
    userUuid: state.uuid === "error" ? null : state.uuid, 
    refresh: () => fetchUser(true) 
  }), [state.id, state.uuid, fetchUser]);
}