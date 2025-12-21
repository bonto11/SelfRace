// src/features/coach/utils/useCoachPrefsLive.ts
"use client";

// Jednoduchý „live“ hook: číta prefs z localStorage a reaguje na zmeny.

import { useEffect, useState } from "react";
import type { CoachPrefs } from "@/features/prefs/types/prefs";
import {
  readCoachPrefsFromStorage,
  subscribeCoachPrefs,
} from "@/features/coach/utils/prefs";

/**
 * Vráti CoachPrefs a automaticky sa aktualizuje po Save/Refresh
 * (cez CustomEvent + storage event).
 */
export default function useCoachPrefsLive(): CoachPrefs {
  const [prefs, setPrefs] = useState<CoachPrefs>(() =>
    readCoachPrefsFromStorage()
  );

  useEffect(() => {
    return subscribeCoachPrefs(setPrefs);
  }, []);

  return prefs;
}
