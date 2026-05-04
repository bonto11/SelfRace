// src/app/features/performance/components/PerformanceDataProvider.tsx (alebo kde to máš)
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

/* API Importy */
import {
  apiFetchUserZonesLatest,
  apiFetchUserZoneTrends,
} from "@/app/features/performance/api/zones";
import {
  apiGetLatestPaces,
  apiGetPaceTrend,
  type PaceHistoryData,
} from "@/app/features/performance/api/paceHistory";
import {
  apiGetVo2MeasuredLatest,
  apiGetVo2MeasuredTrend,
  apiGetVo2EstimatedLatest,
  apiGetVo2EstimatedTrend,
  apiGetBodyFatLatest,
  apiGetBodyFatTrend,
  apiGetWeightLatest,
  apiGetWeightTrend,
  apiGetHrMaxLatest,
} from "@/app/features/performance/api/userMetrics";

import { apiGetStaticProfile } from "@/app/features/performance/api/static";

/* Typy */
import type { ZonesOut } from "@/app/features/performance/types/zonesTypes";

export type PerformanceDataState = {
  latestZones: ZonesOut | null;
  zoneTrends: ZonesOut[];
  latestPace: PaceHistoryData | null;
  paceTrends: PaceHistoryData[];
  vo2MeasuredLatest: any | null;
  vo2MeasuredTrend: any[];
  vo2EstimatedLatest: any | null;
  vo2EstimatedTrend: any[];
  bodyFatLatest: any | null;
  bodyFatTrend: any[];
  weightLatest: any | null;
  bodyWeightTrend: any[];
  hrMaxLatest: any | null;
  profileStatic: any | null;
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
  weightLatest: null,
  bodyWeightTrend: [],
  hrMaxLatest: null,
  profileStatic: null,
};

/* Cache Helpers */
function cacheKey(userId: string) {
  return `PERF_DATA:${userId}`;
}
function hasSessionStorage() {
  return typeof window !== "undefined" && !!window.sessionStorage;
}

function saveCache(userId: string, data: PerformanceDataState) {
  if (!hasSessionStorage()) return;
  sessionStorage.setItem(
    cacheKey(userId),
    JSON.stringify({ savedAt: Date.now(), data }),
  );
}

function loadCache(userId: string): PerformanceDataState | null {
  if (!hasSessionStorage()) return null;
  const raw = sessionStorage.getItem(cacheKey(userId));
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if ((Date.now() - (parsed.savedAt || 0)) / 1000 / 60 > 15) return null;
  return parsed.data as PerformanceDataState;
}

const PerformanceDataContext = createContext<CtxValue | null>(null);

export function usePerformanceData(): CtxValue {
  const ctx = useContext(PerformanceDataContext);
  if (!ctx)
    throw new Error(
      "usePerformanceData must be used within PerformanceDataProvider",
    );
  return ctx;
}

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

  const fetchAllData = useCallback(
    async (uid: number, d: number): Promise<PerformanceDataState> => {
      // 1. ZOHRIEVACÍ REQUEST (Tu tiež pridáme catch pre istotu)
      const latestZones = await apiFetchUserZonesLatest(uid, "running").catch(
        () => null,
      );

      // 2. Hromadný fetch
      // PRIDANÉ .catch(() => null) NA KAŽDÝ PROMISE
      // Vďaka tomuto už NIKDY nezlyhá celý Promise.all kvôli jednému API endpointu!
      const [
        zoneTrends,
        latestPaceRes,
        paceTrendRes,
        vo2MLatest,
        vo2MTrend,
        vo2ELatest,
        vo2ETrend,
        fatLatest,
        fatTrend,
        weightLat,
        weightTrnd,
        hrMaxLat,
        profileStat,
      ] = await Promise.all([
        apiFetchUserZoneTrends(uid, "running", d).catch(() => null),
        apiGetLatestPaces(uid).catch(() => null),
        apiGetPaceTrend(uid, d).catch(() => null),
        apiGetVo2MeasuredLatest(uid).catch(() => null),
        apiGetVo2MeasuredTrend(uid, d).catch(() => null),
        apiGetVo2EstimatedLatest(uid).catch(() => null),
        apiGetVo2EstimatedTrend(uid, d).catch(() => null),
        apiGetBodyFatLatest(uid).catch(() => null),
        apiGetBodyFatTrend(uid, d).catch(() => null),
        apiGetWeightLatest(uid).catch(() => null),
        apiGetWeightTrend(uid, d).catch(() => null),
        apiGetHrMaxLatest(uid).catch(() => null),
        apiGetStaticProfile(uid).catch(() => null),
      ]);

      return {
        latestZones,
        zoneTrends: zoneTrends || [],
        latestPace: (latestPaceRes as any)?.data || null,
        paceTrends:
          (paceTrendRes as any)?.trends || (paceTrendRes as any)?.data || [],
        vo2MeasuredLatest: vo2MLatest?.data || null,
        vo2MeasuredTrend: vo2MTrend?.trends || vo2MTrend?.data || [],
        vo2EstimatedLatest: vo2ELatest?.data || null,
        vo2EstimatedTrend: vo2ETrend?.trends || vo2ETrend?.data || [],
        bodyFatLatest: fatLatest?.data || null,
        bodyFatTrend: fatTrend?.trends || fatTrend?.data || [],
        weightLatest: weightLat?.data || null,
        bodyWeightTrend: weightTrnd?.trends || weightTrnd?.data || [],
        hrMaxLatest: hrMaxLat?.data || null,
        profileStatic: profileStat || null,
      };
    },
    [],
  );

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
          fetchAllData(userId, days)
            .then((fresh) => {
              setData(fresh);
              saveCache(userIdStr, fresh);
            })
            .catch((e) => console.error(e));
          return;
        }
        const fresh = await fetchAllData(userId, days);
        setData(fresh);
        saveCache(userIdStr, fresh);
      } finally {
        setLoading(false);
      }
    },
    [userId, userIdStr, days, fetchAllData],
  );

  useEffect(() => {
    if (userIdStr) refresh(false);
  }, [userIdStr, refresh]);

  return (
    <PerformanceDataContext.Provider
      value={useMemo(
        () => ({ data, loading, refresh }),
        [data, loading, refresh],
      )}
    >
      {children}
    </PerformanceDataContext.Provider>
  );
}
