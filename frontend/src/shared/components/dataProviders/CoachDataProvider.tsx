// src/features/coach/data/CoachDataProvider.tsx
"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { DEFAULT_PREFS, type CoachPrefs } from "@/features/coach/types/prefsTypes";
import type { typePB } from "@/features/coach/types/coach";
import { useUserId } from "@/shared/hooks/useUserId";

// API – prefs
import {
  apiGetPrefs,
  apiSavePrefs,
} from "@/features/coach/api/prefs";

// API – personal bests (RUN)
import {
  apiGetBests,
  type UserBest,
} from "@/shared/api/bests";

import { secToHHMMSS } from "@/shared/utils/time";

// ---------- mapovanie: UserBest (BE) -> Best (pre coach UI) ----------
function mapRunBest(b: UserBest): typePB {
  return {
    distance_m: b.distance_m,
    best_time_s: b.best_time_s ?? undefined,
    time_str:
      b.time_str ??
      (b.best_time_s != null ? secToHHMMSS(b.best_time_s) ?? null : null),
    // BE zatiaľ neposiela názov eventu -> necháme null
    event_name: null,
    date: b.achieved_at ?? null,
  };
}

// ---------- typ kontextu ----------
type CoachCtx = {
  prefs: CoachPrefs;
  pbRun: typePB[];
  refresh: () => Promise<void>;
  savePrefs: (next: CoachPrefs) => Promise<void>;
};

const CoachDataContext = createContext<CoachCtx | null>(null);

export function useCoachData() {
  const ctx = useContext(CoachDataContext);
  if (!ctx) throw new Error("useCoachData must be used within <CoachDataProvider>");
  return ctx;
}

// ---------- provider ----------
export function CoachDataProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useUserId();

  const [prefs, setPrefs] = useState<CoachPrefs>(DEFAULT_PREFS);
  const [pbRun, setPbRun] = useState<typePB[]>([]);

  const refresh = useCallback(async () => {
    if (!userId) return;

    // prefs
    const p = (await apiGetPrefs(userId).catch(() => null)) ?? DEFAULT_PREFS;
    setPrefs(p);

    // PB – RUN
    const runBests: UserBest[] = await apiGetBests(userId, "run").catch(() => []);
    setPbRun(runBests.map(mapRunBest));
  }, [userId]);

  const savePrefs = useCallback(
    async (next: CoachPrefs) => {
      if (!userId) return;
      await apiSavePrefs(userId, next);
      setPrefs(next);
    },
    [userId]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo<CoachCtx>(
    () => ({ prefs, pbRun, refresh, savePrefs }),
    [prefs, pbRun, refresh, savePrefs]
  );

  return (
    <CoachDataContext.Provider value={value}>
      {children}
    </CoachDataContext.Provider>
  );
}