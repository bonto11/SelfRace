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

// Importy z API
import { apiFetchUserZonesLatest, apiFetchUserZoneTrends } from "@/app/features/prefs/api/zones";
import { apiFetchLatestPaceHistory, apiFetchPaceHistoryTrends, type PaceHistoryData } from "@/app/features/performance/api/paceHistory";
import { apiGetVo2History, apiGetVo2Estimate, apiGetMetricHistory } from "@/app/features/performance/api/metrics";

// Importy Typov
import type { ZonesOut } from "@/app/features/coach/types/zonesTypes";
import type { Vo2HistoryApiOk, EstRow, MetricHistoryRow } from "@/app/features/performance/types/performance";

/* ---------- Typy ---------- */

export type PerformanceDataState = {
  // Zones
  latestZones: ZonesOut | null;
  zoneTrends: ZonesOut[];
  
  // Pace
  latestPace: PaceHistoryData | null;
  paceTrends: PaceHistoryData[];
  
  // Metrics (VO2 & BodyFat)
  vo2History: Vo2HistoryApiOk | null;
  vo2Estimate: EstRow | null;
  bodyFatHistory: MetricHistoryRow[];
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
  vo2History: null,
  vo2Estimate: null,
  bodyFatHistory: [],
};

/* ---------- Pomocné funkcie (cache) ---------- */

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
    
    // Rýchla expirácia cache (napr. 15 minút), aby data nezostali staré navždy
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
    throw new Error("usePerformanceData must be used within PerformanceDataProvider");
  }
  return ctx;
}

/* ---------- Provider ---------- */

export function PerformanceDataProvider({
  children,
  days = 90, // default: 3 mesiace pre grafy
}: {
  children: React.ReactNode;
  days?: number;
}) {
  const { userId } = useUserId();

  const userIdStr = useMemo(
    () => (userId == null ? "" : String(userId)),
    [userId]
  );

  const [data, setData] = useState<PerformanceDataState>(EMPTY_DATA);
  const [loading, setLoading] = useState(false);

  // Funkcia, ktorá paralelne stiahne všetky dáta
  const fetchAllData = async (uid: number, days: number): Promise<PerformanceDataState> => {
    const [
      latestZones,
      zoneTrends,
      latestPace,
      paceTrends,
      vo2History,
      vo2Estimate,
      bodyFatHistory
    ] = await Promise.all([
      apiFetchUserZonesLatest(uid, "running"),
      apiFetchUserZoneTrends(uid, "running", days),
      apiFetchLatestPaceHistory(uid),
      apiFetchPaceHistoryTrends(uid, days),
      apiGetVo2History(uid),
      apiGetVo2Estimate(uid),
      apiGetMetricHistory(uid, "body_fat"),
    ]);

    return {
      latestZones,
      zoneTrends,
      latestPace,
      paceTrends,
      vo2History,
      vo2Estimate,
      bodyFatHistory: bodyFatHistory || [],
    };
  };

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

          // Tichý update z API v pozadí
          fetchAllData(userId, days)
            .then((fresh) => {
              setData(fresh);
              saveCache(userIdStr, fresh);
            })
            .catch((e) =>
              console.error("[PERF][refresh] background fetch ERROR", e)
            );

          return;
        }

        // Force fetch – rovno z API a blokuj UI kým sa nenačíta
        const fresh = await fetchAllData(userId, days);
        setData(fresh);
        saveCache(userIdStr, fresh);
      } catch (e) {
        console.error("[PERF][refresh] ERROR", e);
      } finally {
        setLoading(false);
      }
    },
    [userId, userIdStr, days]
  );

  // Init
  useEffect(() => {
    if (!userIdStr) return;

    const cached = loadCache(userIdStr);
    if (cached) {
      setData(cached);
    }

    // Zavolaj refresh v pozadí (tichý update) pri mounte komponenty
    refresh(false).catch((e) =>
      console.error("[PERF][effect] refresh(false) ERROR", e)
    );
  }, [userIdStr, refresh]);

  const value = useMemo<CtxValue>(
    () => ({ data, loading, refresh }),
    [data, loading, refresh]
  );

  return (
    <PerformanceDataContext.Provider value={value}>
      {children}
    </PerformanceDataContext.Provider>
  );
}
