"use client";

import React, { createContext, useContext, useMemo } from "react";
import { DEFAULT_PREFS, type CoachPrefs } from "@/features/coach/types/prefsTypes";
import type { Best } from "@/features/coach/types/coach";

// TODO: neskôr sem doplníš reálny load zo Supabase/BE + normalizáciu
type CoachCtx = {
  prefs: CoachPrefs;
  pbRun: Best[];                 // PB pre beh
};

const CoachDataContext = createContext<CoachCtx | null>(null);

export function useCoachData() {
  const ctx = useContext(CoachDataContext);
  if (!ctx) throw new Error("useCoachData must be used within <CoachDataProvider>");
  return ctx;
}

export function CoachDataProvider({ children }: { children: React.ReactNode }) {
  // --- Dummy dáta (safe defaults) ---
  const prefs: CoachPrefs = DEFAULT_PREFS;

  const pbRun: Best[] = [
    { distance_m: 1000,  time_str: "00:03:52", date: "2024-06-01", event_name: "City Mile" },
    { distance_m: 5000,  time_str: "00:23:13", date: "2024-09-14", event_name: "ParkRun" },
    { distance_m: 10000, time_str: "00:50:17", date: "2023-11-05", event_name: "Autumn 10k" },
  ];

  const value = useMemo<CoachCtx>(() => ({ prefs, pbRun }), [prefs, pbRun]);

  return <CoachDataContext.Provider value={value}>{children}</CoachDataContext.Provider>;
}