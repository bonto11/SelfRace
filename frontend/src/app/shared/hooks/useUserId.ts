"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  
  // Zabraňuje slučke: Zaručí, že fetchUser sa v rámci tohto komponentu spustí sám od seba len RAZ
  const hasFetched = useRef(false);

  const fetchUser = useCallback(async (force = false) => {
    try {
      const supabase = getSupabaseBrowser();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        if (typeof window !== "undefined") window.localStorage.removeItem("selfrace_numeric_id");
        setState({ id: null, uuid: null });
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
         // Ak backend vráti chybu (nie je success), uložíme aspoň uuid, nech vieme, že sme overení voči Supabase
         setState(s => ({ ...s, uuid: session.user.id }));
      }
    } catch (e) {
      console.error("[AUTH: useUserId] 💥 Error in fetchUser:", e);
      globalResolvePromise = null;
      // Aj v prípade fatálneho sieťového erroru (Failed to fetch) necyklíme, ale označíme stav
      setState(s => ({ ...s, uuid: "error" }));
    }
  }, [state.id, state.uuid]);

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
