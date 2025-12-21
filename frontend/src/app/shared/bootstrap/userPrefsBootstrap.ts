"use client";

import { useEffect, useRef } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { apiFetchUserPrefs } from "@/features/prefs/api/prefs";
import { readCoachPrefsFromStorage } from "@/features/coach/utils/prefs";

/**
 * Po prihlásení:
 *  - ak localStorage nemá žiadne prefs, stiahne z DB
 *  - uloží ich lokálne (vrátane coach.prefs)
 */
export default function UserPrefsBootstrapper() {
  const { userId } = useUserId();
  const initialized = useRef(false);

  useEffect(() => {
    if (!userId || initialized.current) return;
    initialized.current = true;

    (async () => {
      try {
        // načítaj všetky prefs z DB
        const prefs = await apiFetchUserPrefs(userId);
        if (Object.keys(prefs).length > 0) {
          for (const [k, v] of Object.entries(prefs)) {
            localStorage.setItem(`up:${k}`, JSON.stringify(v));
          }
        } else {
          // ak žiadne – nech je aspoň coach default
          const def = readCoachPrefsFromStorage();
          localStorage.setItem("up:coach.prefs", JSON.stringify(def));
        }
      } catch (err) {
        console.warn("UserPrefsBootstrapper error:", err);
      }
    })();
  }, [userId]);

  return null;
}
