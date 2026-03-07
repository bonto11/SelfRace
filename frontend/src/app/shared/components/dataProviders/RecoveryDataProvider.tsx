"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useUserId } from "@/app/shared/hooks/useUserId";

/* ---------- API Importy ---------- */
import { 
  apiFetchUserZonesLatest, 
  apiFetchUserZoneTrends 
} from "@/app/features/prefs/api/zones";

import { 
  apiGetLatestPaces, 
  apiGetPaceTrend, 
  type PaceHistoryData 
} from "@/app/features/performance/api/paceHistory";

import { 
  apiGetVo2MeasuredLatest, 
  apiGetVo2MeasuredTrend,
  apiGetVo2EstimatedLatest, 
  apiGetVo2EstimatedTrend,
  apiGetBodyFatLatest, 
  apiGetBodyFatTrend 
} from "@/app/features/performance/api/userMetrics";

/* ---------- Typy ---------- */
import type { ZonesOut } from "@/app/features/coach/types/zonesTypes";

export type PerformanceDataState = {
  // Zones (HR)
  latestZones: ZonesOut | null;
  zoneTrends: ZonesOut[];

  // Paces & Race Predictions
  latestPace: PaceHistoryData | null;
  paceTrends: PaceHistoryData[];

  // VO2 Measured (Watch/Lab)
  vo2MeasuredLatest: any | null;
  vo2MeasuredTrend: any[];

  // VO2 Estimated (AI Coach)
  vo2EstimatedLatest: any | null;
  vo2EstimatedTrend: any[];

  // Body Composition
  bodyFatLatest: any | null;
  bodyFatTrend: any[];
};

type CtxValue = {
  data: PerformanceDataState;
  loading: boolean;
  refresh: (force?: boolean) => Promise<void>;
};

const EMPTY_DATA: PerformanceDataState = {
  latestZones: null,
  zoneTrends: [],
  latestPace: null,
  paceTrends: [],
  vo2MeasuredLatest: null,
  vo2MeasuredTrend: [],
  vo2EstimatedLatest: null,
  vo2EstimatedTrend: [],
  bodyFatLatest: null,
  bodyFatTrend: [],
};

/* ---------- Cache Helpers ---------- */

function hasSessionStorage() {
  return typeof window !== "undefined" && !!window.sessionStorage;
}

function cacheKey(userId: string) {
  return `PERF_DATA:${userId}`;
}

function saveCache(userId: string, data: PerformanceDataState) {
  if (!hasSessionStorage()) return;
  try {
    const payload = JSON.stringify({
      savedAt: Date.now(),
      data,
    });
    sessionStorage.setItem(cacheKey(userId), payload);
  } catch (e) {
    console.error("[PERF][cache] save error:", e);
  }
}

function loadCache(userId: string): PerformanceDataState | null {
  if (!hasSessionStorage()) return null;
  try {
    const raw = sessionStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    // Cache expiruje po 15 minútach
    const ageMinutes = (Date.now() - (parsed.savedAt || 0)) / 1000 / 60;
    if (ageMinutes > 15) {
      sessionStorage.removeItem(cacheKey(userId));
      return null;
    }

    return parsed.data as PerformanceDataState;
  } catch (e) {
    console.error("[PERF][cache] load error:", e);
    return null;
  }
}

/* ---------- Context ---------- */

const PerformanceDataContext = createContext<CtxValue | null>(null);

export function usePerformanceData(): CtxValue {
  const ctx = useContext(PerformanceDataContext);
  if (!ctx) {
    throw new Error(
      "usePerformanceData must be used within PerformanceDataProvider",
    );
  }
  return ctx;
}

/* ---------- Provider Component ---------- */

export function PerformanceDataProvider({
  children,
  days = 90,
}: {
  children: React.ReactNode;
  days?: number;
}) {
  const { userId } = useUserId();

  const userIdStr = useMemo(
    () => (userId == null ? "" : String(userId)),
    [userId],
  );

  const [data, setData] = useState<PerformanceDataState>(EMPTY_DATA);
  const [loading, setLoading] = useState(false);

  // Funkcia na paralelné načítanie všetkých metrík
  const fetchAllData = useCallback(async (
    uid: number,
    d: number,
  ): Promise<PerformanceDataState> => {
    const [
      latestZones,
      zoneTrends,
      latestPaceRes,
      paceTrendRes,
      vo2MLatest,
      vo2MTrend,
      vo2ELatest,
      vo2ETrend,
      fatLatest,
      fatTrend
    ] = await Promise.all([
      apiFetchUserZonesLatest(uid, "running"),
      apiFetchUserZoneTrends(uid, "running", d),
      apiGetLatestPaces(uid),
      apiGetPaceTrend(uid, d),
      apiGetVo2MeasuredLatest(uid),
      apiGetVo2MeasuredTrend(uid, d),
      apiGetVo2EstimatedLatest(uid),
      apiGetVo2EstimatedTrend(uid, d),
      apiGetBodyFatLatest(uid),
      apiGetBodyFatTrend(uid, d),
    ]);

    return {
      latestZones,
      zoneTrends: zoneTrends || [],
      latestPace: (latestPaceRes as any)?.data || null,
      paceTrends: (paceTrendRes as any)?.trends || [],
      vo2MeasuredLatest: vo2MLatest?.data || null,
      vo2MeasuredTrend: vo2MTrend?.trends || [],
      vo2EstimatedLatest: vo2ELatest?.data || null,
      vo2EstimatedTrend: vo2ETrend?.trends || [],
      bodyFatLatest: fatLatest?.data || null,
      bodyFatTrend: fatTrend?.trends || [],
    };
  }, []);

  const refresh = useCallback(
    async (force = false) => {
      if (!userId) return;

      setLoading(true);
      try {
        if (!force) {
          const cached = loadCache(userIdStr);
          if (cached) {
            setData(cached);
            setLoading(false);
          }

          // Update na pozadí
          fetchAllData(userId, days)
            .then((fresh) => {
              setData(fresh);
              saveCache(userIdStr, fresh);
            })
            .catch((e) =>
              console.error("[PERF][refresh] background fetch ERROR", e),
            );

          return;
        }

        // Force refresh
        const fresh = await fetchAllData(userId, days);
        setData(fresh);
        saveCache(userIdStr, fresh);
      } catch (e) {
        console.error("[PERF][refresh] ERROR", e);
      } finally {
        setLoading(false);
      }
    },
    [userId, userIdStr, days, fetchAllData],
  );

  useEffect(() => {
    if (!userIdStr) return;

    const cached = loadCache(userIdStr);
    if (cached) {
      setData(cached);
    }

    refresh(false).catch((e) =>
      console.error("[PERF][effect] refresh(false) ERROR", e),
    );
  }, [userIdStr, refresh]);

  const value = useMemo<CtxValue>(
    () => ({ data, loading, refresh }),
    [data, loading, refresh],
  );

  return (
    <PerformanceDataContext.Provider value={value}>
      {children}
    </PerformanceDataContext.Provider>
  );
}
