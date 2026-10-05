// src/app/shared/components/dataProviders/CoachDataProvider.tsx
"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { DEFAULT_PREFS, type CoachPrefs } from "@/app/features/prefs/types/prefs";
import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  apiFetchUserPref,
  apiUpsertUserPref,
} from "@/app/features/prefs/api/prefs";
import { todayISO, addDays } from "@/app/shared/utils/time";
import { fetchPlanRangeApi } from "@/app/features/coach/api/planApi";
import {
  apiGetLatestWeeklyPlan,
  type WeeklyPlanLatest,
} from "@/app/features/coach/api/coach_plan_weekly";
import {
  apiGetLatestAthleteState,
  apiGetLatestAthleteProgress,
  type AthleteStateRecord,
  type AthleteProgressRecord,
} from "@/app/features/coach/api/coach_athlete_state";
import {
  apiActivePlanStatus,
  apiGetLatestPlanSummary,
  type ActivePlanStatus,
  type PlanSummaryRecord,
} from "@/app/features/coach/api/coach_plan_active";
import { apiGetCoachNotes, type CoachNotesData } from "@/app/features/coach/api/coach_user_notes";
import {
  apiGetActiveHealthLogs,
  type HealthLogRecord,
} from "@/app/features/coach/api/users_health_log";
import { apiGetExternalEvents } from "@/app/features/coach/api/coach_external_events";
import type { ExternalEvent } from "@/app/features/coach/types/externalEvents";
import { apiGetPlanCompliance } from "@/app/features/coach/api/coach_plan_daily";
import {
  useCachedResource,
  type CachedResource,
} from "@/app/shared/components/dataProviders/useCachedResource";

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
  /** true len keď ešte nemáme jadro (prefs/plán/týždeň) alebo beží ručný refresh */
  loading: boolean;

  // coach prefs
  prefs: CoachPrefs;
  /** prefs sú načítané (z cache alebo BE) - dovtedy je `prefs` len default */
  prefsLoaded: boolean;
  refresh: (force?: boolean) => Promise<void>;
  savePrefs: (next: CoachPrefs) => Promise<void>;

  // plán (denný, riadky)
  plan: PlanSubCtx;

  // weekly plán, ako súčasť tej istej globálnej dátovej vrstvy - predtým
  // ho WidgetCoachWeeklyPlan a DetailWeeklyPlan fetchovali každý sám
  // nezávisle, takže globálny refresh ich neobnovil.
  weekly: WeeklySubCtx;

  /*
   * Lenivé zdroje pre coach widgety. Widget si zdroj aktivuje cez
   * useEnsure(...). Predtým si každý widget ťahal dáta sám pri každom
   * mounte; teraz sú v cache, zdieľajú request a obnoví ich aj globálny
   * refresh (tlačidlo Obnoviť na coach stránke).
   */
  athleteState: CachedResource<AthleteStateRecord | null>;
  planSummary: CachedResource<PlanSummaryRecord | null>;
  progress: CachedResource<AthleteProgressRecord | null>;
  notes: CachedResource<CoachNotesData | null>;
  healthActive: CachedResource<HealthLogRecord[]>;
  externalEvents: CachedResource<ExternalEvent[]>;
  compliance: CachedResource<any>;
  activePlanStatus: CachedResource<ActivePlanStatus | null>;
};

const CoachDataContext = createContext<CoachCtx | null>(null);

export function useCoachData() {
  const ctx = useContext(CoachDataContext);
  if (!ctx)
    throw new Error("useCoachData must be used within <CoachDataProvider>");
  return ctx;
}

// 🌟 NOVÉ: verzia bez throw - pre komponenty, ktoré môžu byť vykreslené aj
// mimo providera (napr. PlanLifecycleSection v prefs). Vracia null, ak
// provider nad komponentom nie je, takže volajúci môže bezpečne spraviť
// `coach?.refresh(true)` po generovaní plánu.
export function useCoachDataOptional(): CoachCtx | null {
  return useContext(CoachDataContext);
}

const EMPTY_ROWS: PlanRow[] = [];

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
  const uid = userId as number;

  const today = todayISO();
  const rangeStart = addDays(today, -(pastDays - 1));
  const rangeEnd = addDays(today, futureDays);

  // -------- jadro (načíta sa hneď pri štarte) --------
  const prefsRes = useCachedResource<CoachPrefs>({
    key: userId ? `coach:prefs:${userId}` : null,
    fetcher: async () => (await apiFetchUserPref(uid, "coach.prefs")) ?? DEFAULT_PREFS,
    eager: true,
  });

  // kľúč je podľa veľkosti okna, nie dátumov - cache platí aj na druhý deň,
  // fetcher si dátumy počíta v čase volania
  const planRes = useCachedResource<PlanRow[]>({
    key: userId ? `coach:plan:${userId}:${pastDays}:${futureDays}` : null,
    fetcher: async () => {
      const t0 = todayISO();
      const rows = await fetchPlanRangeApi(
        uid,
        addDays(t0, -(pastDays - 1)),
        addDays(t0, futureDays),
      );
      return rows as PlanRow[];
    },
    eager: true,
  });

  const weeklyRes = useCachedResource<WeeklyPlanLatest | null>({
    key: userId ? `coach:weekly:${userId}` : null,
    fetcher: async () => (await apiGetLatestWeeklyPlan(uid)) ?? null,
    eager: true,
  });

  // -------- lenivé zdroje widgetov --------
  const athleteState = useCachedResource<AthleteStateRecord | null>({
    key: userId ? `coach:athlete-state:${userId}` : null,
    fetcher: async () => (await apiGetLatestAthleteState(uid)) ?? null,
  });
  const planSummary = useCachedResource<PlanSummaryRecord | null>({
    key: userId ? `coach:plan-summary:${userId}` : null,
    fetcher: async () => (await apiGetLatestPlanSummary(uid)) ?? null,
  });
  const progress = useCachedResource<AthleteProgressRecord | null>({
    key: userId ? `coach:progress:${userId}` : null,
    fetcher: async () => (await apiGetLatestAthleteProgress(uid)) ?? null,
  });
  const notes = useCachedResource<CoachNotesData | null>({
    key: userId ? `coach:notes:${userId}` : null,
    fetcher: async () => (await apiGetCoachNotes(uid)) ?? null,
  });
  const healthActive = useCachedResource<HealthLogRecord[]>({
    key: userId ? `coach:health-active:${userId}` : null,
    fetcher: async () => (await apiGetActiveHealthLogs(uid)) ?? [],
  });
  const externalEvents = useCachedResource<ExternalEvent[]>({
    key: userId ? `coach:external-events:${userId}` : null,
    fetcher: async () => (await apiGetExternalEvents(uid)) ?? [],
  });
  const compliance = useCachedResource<any>({
    key: userId ? `coach:compliance:${userId}` : null,
    fetcher: async () => (await apiGetPlanCompliance(uid)) ?? null,
  });
  const activePlanStatus = useCachedResource<ActivePlanStatus | null>({
    key: userId ? `coach:active-plan-status:${userId}` : null,
    fetcher: async () => (await apiActivePlanStatus(uid)) ?? null,
  });

  // ručný refresh (tlačidlo, po uložení) - zobrazí loading aj keď máme dáta
  const [manualRefreshing, setManualRefreshing] = useState(0);

  const withManual = useCallback(async (fn: () => Promise<unknown>) => {
    setManualRefreshing((n) => n + 1);
    try {
      await fn();
    } finally {
      setManualRefreshing((n) => Math.max(0, n - 1));
    }
  }, []);

  const savePrefs = useCallback(
    async (next: CoachPrefs) => {
      if (!userId) return;
      await apiUpsertUserPref(userId, "coach.prefs", next);
      prefsRes.setData(() => next);
    },
    [userId, prefsRes.setData],
  );

  const refreshPlan = useCallback(
    (_force = false) => withManual(() => planRes.refresh()),
    [withManual, planRes.refresh],
  );

  const refreshWeekly = useCallback(
    (_force = false) => withManual(() => weeklyRes.refresh()),
    [withManual, weeklyRes.refresh],
  );

  const selectPlanByRange = useCallback(
    (start: string, end: string): PlanRow[] => {
      const rows = planRes.data ?? EMPTY_ROWS;
      if (!rows.length) return [];
      return rows.filter((r) => r.plan_date >= start && r.plan_date <= end);
    },
    [planRes.data],
  );

  // -------- spoločný refresh --------
  // Jadro vždy, lenivé zdroje len tie, ktoré už niekto použil.
  const refresh = useCallback(
    (_force = false) =>
      withManual(() =>
        Promise.all([
          prefsRes.refresh(),
          planRes.refresh(),
          weeklyRes.refresh(),
          athleteState.revalidate(),
          planSummary.revalidate(),
          progress.revalidate(),
          notes.revalidate(),
          healthActive.revalidate(),
          externalEvents.revalidate(),
          compliance.revalidate(),
          activePlanStatus.revalidate(),
        ]),
      ),
    [
      withManual,
      prefsRes.refresh,
      planRes.refresh,
      weeklyRes.refresh,
      athleteState.revalidate,
      planSummary.revalidate,
      progress.revalidate,
      notes.revalidate,
      healthActive.revalidate,
      externalEvents.revalidate,
      compliance.revalidate,
      activePlanStatus.revalidate,
    ],
  );

  const coreLoaded = prefsRes.loaded && planRes.loaded && weeklyRes.loaded;
  const planRows = planRes.data ?? EMPTY_ROWS;
  const isManual = manualRefreshing > 0;

  const value = useMemo<CoachCtx>(
    () => ({
      loading: !coreLoaded || isManual,

      prefs: prefsRes.data ?? DEFAULT_PREFS,
      prefsLoaded: prefsRes.loaded,
      refresh,
      savePrefs,

      plan: {
        rangeStart,
        rangeEnd,
        rows: planRows,
        loading: !planRes.loaded || isManual,
        hasAnyPlan: planRows.length > 0,
        refresh: refreshPlan,
        selectPlanByRange,
      },

      weekly: {
        plan: weeklyRes.data ?? null,
        loading: !weeklyRes.loaded || isManual,
        refresh: refreshWeekly,
      },

      athleteState,
      planSummary,
      progress,
      notes,
      healthActive,
      externalEvents,
      compliance,
      activePlanStatus,
    }),
    [
      coreLoaded,
      isManual,
      prefsRes.data,
      prefsRes.loaded,
      refresh,
      savePrefs,
      rangeStart,
      rangeEnd,
      planRows,
      planRes.loaded,
      refreshPlan,
      selectPlanByRange,
      weeklyRes.data,
      weeklyRes.loaded,
      refreshWeekly,
      athleteState,
      planSummary,
      progress,
      notes,
      healthActive,
      externalEvents,
      compliance,
      activePlanStatus,
    ]
  );

  return (
    <CoachDataContext.Provider value={value}>
      {children}
    </CoachDataContext.Provider>
  );
}
