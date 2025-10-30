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

import { useUserId } from "@/shared/hooks/useUserId";
import { getPrefs } from "@/features/coach/api/prefs";
import { getBests, type UserBest } from "@/shared/api/bests";
import { secToHHMMSS } from "@/shared/utils/time";

import {
  DEFAULT_PREFS,
  type CoachPrefs,
} from "@/features/coach/types/prefsTypes";
import type { Best } from "@/features/coach/types/coach";

type CoachCtx = {
  prefs: CoachPrefs;
  pbRun: Best[];
  refresh: () => Promise<void>;
};

const CoachDataContext = createContext<CoachCtx | null>(null);

export function useCoachData() {
  const ctx = useContext(CoachDataContext);
  if (!ctx) throw new Error("useCoachData must be used within <CoachDataProvider>");
  return ctx;
}

// helper: mapovanie UserBest -> Best (FE tvar)
function toBestRow(b: UserBest): Best {
  return {
    distance_m: b.distance_m,
    time_str:
      b.time_str ??
      (Number.isFinite(b.best_time_s as number)
        ? secToHHMMSS(b.best_time_s as number) ?? null
        : null),
    best_time_s: b.best_time_s ?? undefined,
    date: (b.achieved_at as string) ?? null,
    event_name: (b as any).event_name ?? null, // ak neskôr pridáš na BE
  };
}

export function CoachDataProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useUserId();

  const [prefs, setPrefs] = useState<CoachPrefs>(DEFAULT_PREFS);
  const [pbRun, setPbRun] = useState<Best[]>([]);

  const refresh = useCallback(async () => {
    if (!userId) return;

    // prefs
    try {
      const p = (await getPrefs(userId)) ?? DEFAULT_PREFS;
      setPrefs(p);
    } catch {
      setPrefs(DEFAULT_PREFS);
    }

    // PB – RUN
    try {
      const rows = await getBests(userId, "run");
      setPbRun(rows.map(toBestRow));
    } catch {
      // nechaj prázdne, UI to zvládne
      setPbRun([]);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo<CoachCtx>(
    () => ({ prefs, pbRun, refresh }),
    [prefs, pbRun, refresh]
  );

  return (
    <CoachDataContext.Provider value={value}>
      {children}
    </CoachDataContext.Provider>
  );
}