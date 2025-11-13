"use client";

import { useEffect, useState } from "react";
import type { CoachPrefs } from "@/features/coach/types/prefsTypes";
import { readCoachPrefsFromStorage, subscribeCoachPrefs } from "@/features/coach/utils/prefs";

/** Jednoduchý „live“ hook: vráti prefs a automaticky sa aktualizuje po Save/Refresh */
export default function useCoachPrefsLive(): CoachPrefs {
  const [prefs, setPrefs] = useState<CoachPrefs>(() => readCoachPrefsFromStorage());
  useEffect(() => {
    return subscribeCoachPrefs(setPrefs);
  }, []);
  return prefs;
}