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

import { DEFAULT_PREFS, type CoachPrefs } from "@/features/prefs/types/prefs";
import type { typePB } from "@/features/coach/types/coachTypes";
import { useUserId } from "@/shared/hooks/useUserId";
import {
  apiGetCoachPrefs,
  apiSaveCoachPrefs,
} from "@/features/coach/api/prefs";
import { apiGetBests, type UserBest } from "@/features/bests/api/bests";
import { secToHHMMSS, todayISO, addDays } from "@/shared/utils/time";
import { fetchPlanRangeApi } from "@/features/coach/api/planApi";

/* ----------------- PB mapovanie ----------------- */

function mapRunBest(b: UserBest): typePB {
  return {
    distance_m: b.distance_m,
    best_time_s: b.best_time_s ?? undefined,
    time_str:
      b.time_str ??
      (b.best_time_s != null ? secToHHMMSS(b.best_time_s) ?? null : null),
    event_name: null,
    date: b.achieved_at ?? null,
  };
}

/* ----------------- Typy pre plán ----------------- */

export type PlanRow = {
  id: number;
  user_id: number;
  plan_date: string; // "YYYY-MM-DD"
  sport: string;

  title?: string | null;
  duration_min?: number | null;
  intensity?: string | null;
  plan_id?: string | null;
  activity_id?: number | null;
  session_type?: string | null;
  session_index?: number | null;
  payload?: any;
  source?: string | null;

  [key: string]: any;
};

type PlanSubCtx = {
  rangeStart: string;
  rangeEnd: string;
  rows: PlanRow[];
  loading: boolean;
  hasAnyPlan: boolean;
  refresh: (force?: boolean) => Promise<void>;
  selectPlanByRange: (start: string, end: string) => PlanRow[];
};

/* ----------------- Typ kontextu ----------------- */

type CoachCtx = {
  // coach prefs + PB (existujúce)
  prefs: CoachPrefs;
  pbRun: typePB[];
  refresh: () => Promise<void>;
  savePrefs: (next: CoachPrefs) => Promise<void>;

  // nový blok: plán
  plan: PlanSubCtx;
};

const CoachDataContext = createContext<CoachCtx | null>(null);

export function useCoachData() {
  const ctx = useContext(CoachDataContext);
  if (!ctx)
    throw new Error("useCoachData must be used within <CoachDataProvider>");
  return ctx;
}

/* ----------------- Provider ----------------- */

export function CoachDataProvider({
  children,
  pastDays = 90,
  futureDays = 15,
}: {
  children: React.ReactNode;
  pastDays?: number;
  futureDays?: number;
}) {
  const { userId } = useUserId();

  // -------- prefs + PB --------
  const [prefs, setPrefs] = useState<CoachPrefs>(DEFAULT_PREFS);
  const [pbRun, setPbRun] = useState<typePB[]>([]);

  const refreshCoachCore = useCallback(async () => {
    if (!userId) return;

    // prefs
    const p =
      (await apiGetCoachPrefs(userId).catch(() => null)) ?? DEFAULT_PREFS;
    setPrefs(p);

    // PB – RUN
    const runBests: UserBest[] = await apiGetBests(userId, "run").catch(
      () => []
    );
    setPbRun(runBests.map(mapRunBest));
  }, [userId]);

  const savePrefs = useCallback(
    async (next: CoachPrefs) => {
      if (!userId) return;
      await apiSaveCoachPrefs(userId, next);
      setPrefs(next);
    },
    [userId]
  );

  // -------- plán --------
  const [planRows, setPlanRows] = useState<PlanRow[]>([]);
  const [planLoading, setPlanLoading] = useState(false);

  const today = todayISO();
  const rangeStart = addDays(today, -(pastDays - 1));
  const rangeEnd = addDays(today, futureDays);

  const refreshPlan = useCallback(
    async (force = false): Promise<void> => {
      if (userId == null) {
        setPlanRows([]);
        return;
      }

      // force tu zatiaľ nerozlišujeme – nechávame parameter kvôli budúcnosti
      setPlanLoading(true);
      try {
        const norm = await fetchPlanRangeApi(userId, rangeStart, rangeEnd);
        setPlanRows(norm as PlanRow[]);
      } catch (e) {
        console.error("[PLAN][provider] fetchRange ERROR", e);
        setPlanRows([]);
      } finally {
        setPlanLoading(false);
      }
    },
    [userId, rangeStart, rangeEnd]
  );

  const selectPlanByRange = useCallback(
    (start: string, end: string): PlanRow[] => {
      if (!planRows.length) return [];
      return planRows.filter((r) => r.plan_date >= start && r.plan_date <= end);
    },
    [planRows]
  );

  // -------- spoločný refresh --------
  const refresh = useCallback(async () => {
    await Promise.all([refreshCoachCore(), refreshPlan(true)]);
  }, [refreshCoachCore, refreshPlan]);

  // init / zmena usera alebo rozsahu
  useEffect(() => {
    if (!userId) {
      setPrefs(DEFAULT_PREFS);
      setPbRun([]);
      setPlanRows([]);
      return;
    }
    void refresh();
  }, [userId, refresh]);

  const value = useMemo<CoachCtx>(
    () => ({
      prefs,
      pbRun,
      refresh,
      savePrefs,
      plan: {
        rangeStart,
        rangeEnd,
        rows: planRows,
        loading: planLoading,
        hasAnyPlan: planRows.length > 0,
        refresh: refreshPlan,
        selectPlanByRange,
      },
    }),
    [
      prefs,
      pbRun,
      refresh,
      savePrefs,
      rangeStart,
      rangeEnd,
      planRows,
      planLoading,
      refreshPlan,
      selectPlanByRange,
    ]
  );

  return (
    <CoachDataContext.Provider value={value}>
      {children}
    </CoachDataContext.Provider>
  );
}
