// src/app/shared/components/dataProviders/PerformanceDataProvider.tsx
"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  useCachedResource,
  useEnsure,
  type CachedResource,
} from "@/app/shared/components/dataProviders/useCachedResource";
import { apiGetBests } from "@/app/features/bests/api/bests";
import type { UserBest } from "@/app/features/bests/types/bests";
import { apiGetLatestBodyScan } from "@/app/features/performance/api/bodyScan";
import type { BodyScan } from "@/app/features/performance/types/bodyScan";

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
  /** true len keď ešte nemáme žiadne dáta alebo beží ručný refresh */
  loading: boolean;
  refresh: (force?: boolean) => Promise<void>;
};

type PerformanceExtras = {
  /** bežecké PB (WidgetPB) */
  bestsRun: CachedResource<UserBest[]>;
  bodyScan: CachedResource<BodyScan | null>;
};

type InternalCtx = CtxValue & PerformanceExtras & {
  resource: CachedResource<PerformanceDataState>;
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

const PerformanceDataContext = createContext<InternalCtx | null>(null);

function usePerformanceCtx(): InternalCtx {
  const ctx = useContext(PerformanceDataContext);
  if (!ctx)
    throw new Error(
      "usePerformanceData must be used within PerformanceDataProvider",
    );
  return ctx;
}

/**
 * Výkonnostné dáta (14 endpointov) sa načítajú až keď ich niekto použije -
 * predtým sa ťahali pri štarte na každej stránke, aj keď user performance
 * sekciu vôbec neotvoril.
 */
export function usePerformanceData(): CtxValue {
  const ctx = usePerformanceCtx();
  useEnsure(ctx.resource);
  return ctx;
}

/** Ďalšie performance zdroje - widget si ich aktivuje cez useEnsure. */
export function usePerformanceExtras(): PerformanceExtras {
  const { bestsRun, bodyScan } = usePerformanceCtx();
  return { bestsRun, bodyScan };
}

async function fetchAllData(
  uid: number,
  d: number,
): Promise<PerformanceDataState> {
  // Všetko paralelne a každý request s vlastným catch - jeden zlyhaný
  // endpoint nezhodí ostatné.
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
    fatTrend,
    weightLat,
    weightTrnd,
    hrMaxLat,
    profileStat,
  ] = await Promise.all([
    apiFetchUserZonesLatest(uid, "running").catch(() => null),
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

  // všetko zlyhalo (BE nedostupný) - radšej ponecháme dáta z cache,
  // než by sme ich prepísali prázdnymi
  const all = [
    latestZones, zoneTrends, latestPaceRes, paceTrendRes, vo2MLatest, vo2MTrend,
    vo2ELatest, vo2ETrend, fatLatest, fatTrend, weightLat, weightTrnd, hrMaxLat,
    profileStat,
  ];
  if (all.every((x) => x == null)) throw new Error("api.common.fetchFailed");

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
}

export function PerformanceDataProvider({
  children,
  days = 90,
}: {
  children: React.ReactNode;
  days?: number;
}) {
  const { userId } = useUserId();

  const resource = useCachedResource<PerformanceDataState>({
    key: userId ? `perf:${userId}:${days}` : null,
    fetcher: () => fetchAllData(userId as number, days),
  });

  const bestsRun = useCachedResource<UserBest[]>({
    key: userId ? `perf:bests-run:${userId}` : null,
    fetcher: async () => {
      const r = await apiGetBests(userId as number, "run");
      return Array.isArray(r) ? r : [];
    },
  });

  const bodyScan = useCachedResource<BodyScan | null>({
    key: userId ? `perf:body-scan:${userId}` : null,
    fetcher: () => apiGetLatestBodyScan(userId as number),
  });

  const [manualRefreshing, setManualRefreshing] = useState(false);

  const refresh = useCallback(
    async (_force = false) => {
      setManualRefreshing(true);
      try {
        await Promise.all([
          resource.refresh(),
          bestsRun.revalidate(),
          bodyScan.revalidate(),
        ]);
      } finally {
        setManualRefreshing(false);
      }
    },
    [resource.refresh, bestsRun.revalidate, bodyScan.revalidate],
  );

  const value = useMemo<InternalCtx>(
    () => ({
      data: resource.data ?? EMPTY_DATA,
      loading: !resource.loaded || manualRefreshing,
      refresh,
      resource,
      bestsRun,
      bodyScan,
    }),
    [resource, manualRefreshing, refresh, bestsRun, bodyScan],
  );

  return (
    <PerformanceDataContext.Provider value={value}>
      {children}
    </PerformanceDataContext.Provider>
  );
}
