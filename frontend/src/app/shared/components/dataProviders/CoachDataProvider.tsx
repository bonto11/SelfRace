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

import { DEFAULT_PREFS, type CoachPrefs } from "@/app/features/prefs/types/prefs";
import { typePB, UserBest } from "@/app/features/bests/types/bests";
import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  apiFetchUserPref,
  apiUpsertUserPref,
} from "@/app/features/prefs/api/prefs";
import { apiGetBests } from "@/app/features/bests/api/bests";
import { secToHHMMSS, todayISO, addDays } from "@/app/shared/utils/time";
import { fetchPlanRangeApi } from "@/app/features/coach/api/planApi";
import {
  apiGetLatestWeeklyPlan,
  type WeeklyPlanLatest,
} from "@/app/features/coach/api/coach_plan_weekly";
import { useT } from "@/app/shared/i18n/useT";

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
  activity_id?: number | null;
  status?: "planned" | "done" | "postponed" | "missed";
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

type WeeklySubCtx = {
  plan: WeeklyPlanLatest | null;
  loading: boolean;
  refresh: (force?: boolean) => Promise<void>;
};

/* ----------------- Typ kontextu ----------------- */

type CoachCtx = {
  loading: boolean;

  // coach prefs + PB
  prefs: CoachPrefs;
  pbRun: typePB[];
  refresh: (force?: boolean) => Promise<void>;
  savePrefs: (next: CoachPrefs) => Promise<void>;

  // plán (denný, riadky)
  plan: PlanSubCtx;

  // 🌟 NOVÉ: weekly plán, ako súčasť tej istej globálnej dátovej vrstvy -
  // predtým ho WidgetCoachWeeklyPlan a DetailWeeklyPlan fetchovali každý
  // sám nezávisle (vlastný useEffect na mount), takže kliknutie na globálne
  // "refresh" tlačidlo (RefreshIconBtn -> refreshCoach) ich vôbec
  // neobnovilo - dáta sa updatli až po plnom odhlásení/prihlásení
  // (remount). Presunutím fetchu sem sa weekly plán obnoví presne vtedy,
  // keď sa obnoví aj zvyšok (refresh()).
  weekly: WeeklySubCtx;
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
  const t = useT();

  // -------- prefs + PB --------
  const [prefs, setPrefs] = useState<CoachPrefs>(DEFAULT_PREFS);
  const [pbRun, setPbRun] = useState<typePB[]>([]);
  const [coachLoading, setCoachLoading] = useState(false);

  const refreshCoachCore = useCallback(async () => {
    if (!userId) return;

    setCoachLoading(true);
    try {
      // prefs
      const p =
        (await apiFetchUserPref(userId, "coach.prefs").catch((e) => {
            console.warn("[CoachProvider] prefs load failed", t(e?.message as any));
            return null;
        })) ??
        DEFAULT_PREFS;
      setPrefs(p);

      // PB – RUN
      const runBests: UserBest[] = await apiGetBests(userId, "run").catch((e) => {
          console.warn("[CoachProvider] PB load failed", t(e?.message as any));
          return [];
      });
      setPbRun(runBests.map(mapRunBest));
    } finally {
      setCoachLoading(false);
    }
  }, [userId, t]);

  const savePrefs = useCallback(
    async (next: CoachPrefs) => {
      if (!userId) return;
      await apiUpsertUserPref(userId, "coach.prefs", next);
      setPrefs(next);
    },
    [userId]
  );

  // -------- plán (denné riadky) --------
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

      setPlanLoading(true);
      try {
        const norm = await fetchPlanRangeApi(userId, rangeStart, rangeEnd);
        setPlanRows(norm as PlanRow[]);
      } catch (e: any) {
        console.error("[PLAN][provider] fetchRange ERROR", t(e?.message as any) || t("api.coach.planFetchFailed"));
        setPlanRows([]);
      } finally {
        setPlanLoading(false);
      }
    },
    [userId, rangeStart, rangeEnd, t]
  );

  const selectPlanByRange = useCallback(
    (start: string, end: string): PlanRow[] => {
      if (!planRows.length) return [];
      return planRows.filter((r) => r.plan_date >= start && r.plan_date <= end);
    },
    [planRows]
  );

  // -------- weekly plán --------
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlanLatest | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);

  const refreshWeekly = useCallback(
    async (_force = false): Promise<void> => {
      if (userId == null) {
        setWeeklyPlan(null);
        return;
      }

      setWeeklyLoading(true);
      try {
        const r = await apiGetLatestWeeklyPlan(userId);
        setWeeklyPlan(r ?? null);
      } catch (e: any) {
        console.error("[WEEKLY][provider] fetch ERROR", t(e?.message as any));
        setWeeklyPlan(null);
      } finally {
        setWeeklyLoading(false);
      }
    },
    [userId, t]
  );

  // -------- spoločný refresh --------
  const refresh = useCallback(
    async (force = false) => {
      await Promise.all([refreshCoachCore(), refreshPlan(force), refreshWeekly(force)]);
    },
    [refreshCoachCore, refreshPlan, refreshWeekly]
  );

  // init / zmena usera alebo rozsahu
  useEffect(() => {
    if (!userId) {
      setPrefs(DEFAULT_PREFS);
      setPbRun([]);
      setPlanRows([]);
      setWeeklyPlan(null);
      setCoachLoading(false);
      return;
    }
    void refresh(true);
  }, [userId, refresh]);

  const value = useMemo<CoachCtx>(
    () => ({
      loading: coachLoading || planLoading || weeklyLoading,

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

      weekly: {
        plan: weeklyPlan,
        loading: weeklyLoading,
        refresh: refreshWeekly,
      },
    }),
    [
      coachLoading,
      planLoading,
      weeklyLoading,
      prefs,
      pbRun,
      refresh,
      savePrefs,
      rangeStart,
      rangeEnd,
      planRows,
      refreshPlan,
      selectPlanByRange,
      weeklyPlan,
      refreshWeekly,
    ]
  );

  return (
    <CoachDataContext.Provider value={value}>
      {children}
    </CoachDataContext.Provider>
  );
}
