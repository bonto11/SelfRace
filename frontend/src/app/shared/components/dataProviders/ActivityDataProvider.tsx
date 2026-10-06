// src/app/shared/components/dataProviders/ActivityDataProvider.tsx
"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useUserId } from "@/app/shared/hooks/useUserId";
import { aggregateWeeks } from "@/app/features/activities/utils/activity";
import { addDaysIso, todayLocalISO } from "@/app/shared/utils/time";

import type {
  ActivityRow,
  WeekRow,
  StreamsData,
  Metric,
} from "@/app/features/activities/types/activities";
import type { Rolling7 } from "@/app/features/activities/types/MonoStrain";

import {
  apiFetchParetoWidget,
  apiFetchParetoTrend,
  apiFetchActivityExtrasCombined,
  apiGetLastActivityBundle,
  apiGetTodayActivitiesBundle,
  apiGetStreak,
  type StreakData,
} from "@/app/features/activities/api/analytics_activities";
import {
  apiGetMonthlySummary,
  type MonthlySummary,
} from "@/app/features/activities/api/monthly_summary";
import {
  apiGetActivitiesWrappedStatus,
  type ActivitiesWrappedStatus,
} from "@/app/features/activities/api/activities_wrapped";
import {
  apiListStrengthSessions,
  type StrengthSession,
} from "@/app/features/strength/api/strength_sessions";
import { apiGetStravaStatus, type StravaStatus } from "@/app/features/strava/api/strava";
import {
  useCachedResource,
  type CachedResource,
} from "@/app/shared/components/dataProviders/useCachedResource";
import type { ParetoTrendResponse } from "@/app/features/activities/types/pareto";
import type { ActivityExtrasCombined } from "@/app/features/activities/types/activities";
import { toast } from "@/app/shared/ui/components/Toast";
import { useT } from "@/app/shared/i18n/useT";

import { apiFetchRange } from "@/app/features/activities/api/activities_summary";

import {
  apiGetActivityEnrichment,
  apiGetRouteOverview,
  type RouteOverviewEntry,
} from "@/app/features/activities/api/activities_enrichment";
import type { ActivityEnrichment } from "@/app/features/activities/types/activities_enrichment";

import { hasSesssioStorage } from "@/app/shared/utils/sessionStorage";

/* ------------------------------ cache helpers ------------------------------ */

function rangeKey(userId: number, start: string, end: string) {
  return `ACT:RANGE:${userId}:${start}:${end}`;
}
function extrasKey(activityId: number) {
  return `ACT:EXTRAS:v1:${activityId}`;
}
function enrichmentKey(activityId: number) {
  return `ACT:ENRICH:v1:${activityId}`;
}
function lastActivityKey(userId: number) {
  return `ACT:LAST:v1:${userId}`;
}
function todayActivitiesKey(userId: number, dateIso: string) {
  return `ACT:TODAY:v1:${userId}:${dateIso}`;
}

function saveRange(
  userId: number,
  start: string,
  end: string,
  rows: ActivityRow[],
) {
  if (!hasSesssioStorage()) return;
  try {
    sessionStorage.setItem(
      rangeKey(userId, start, end),
      JSON.stringify({ at: Date.now(), rows }),
    );
  } catch {}
}

function loadRange(
  userId: number,
  start: string,
  end: string,
): ActivityRow[] | null {
  if (!hasSesssioStorage()) return null;
  try {
    const raw = sessionStorage.getItem(rangeKey(userId, start, end));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.rows) ? (parsed.rows as ActivityRow[]) : [];
  } catch {
    return null;
  }
}

/* ------------------------------ cache helpers (Enrichment) ------------------------------ */

function saveEnrichment(activityId: number, data: ActivityEnrichment) {
  if (!hasSesssioStorage()) return;
  try {
    sessionStorage.setItem(
      enrichmentKey(activityId),
      JSON.stringify({ at: Date.now(), data }),
    );
  } catch {}
}

function loadEnrichment(activityId: number): ActivityEnrichment | null {
  if (!hasSesssioStorage()) return null;
  try {
    const raw = sessionStorage.getItem(enrichmentKey(activityId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.data ?? null;
  } catch {
    return null;
  }
}

/* ------------------------------ streams normalize ------------------------------ */

function normalizeStreams(raw: any): StreamsData | null {
  if (!raw || typeof raw !== "object") return null;

  const time_s = Array.isArray(raw?.time_s) ? (raw.time_s as number[]) : [];
  if (!time_s.length) {
    return null;
  }

  const hr = Array.isArray(raw?.hr)
    ? (raw.hr as (number | null)[])
    : Array.isArray(raw?.heartrate_bpm)
      ? (raw.heartrate_bpm as (number | null)[])
      : [];

  const altitude_m = Array.isArray(raw?.altitude_m)
    ? (raw.altitude_m as (number | null)[])
    : [];
  const distance_m = Array.isArray(raw?.distance_m)
    ? (raw.distance_m as (number | null)[])
    : [];
  const cadence_rpm = Array.isArray(raw?.cadence_rpm)
    ? (raw.cadence_rpm as (number | null)[])
    : [];
  const power_w = Array.isArray(raw?.power_w)
    ? (raw.power_w as (number | null)[])
    : [];

  const lastT = time_s.length ? Number(time_s[time_s.length - 1]) : 0;
  const duration_s = Number.isFinite(lastT) ? lastT || 0 : 0;

  return {
    time_s,
    hr,
    altitude_m,
    distance_m,
    cadence_rpm,
    power_w,
    duration_s,
  };
}

function saveExtras(activityId: number, data: ActivityExtrasCombined) {
  if (!hasSesssioStorage()) return;
  try {
    const normStreams = normalizeStreams((data as any)?.streams) ?? null;

    sessionStorage.setItem(
      extrasKey(activityId),
      JSON.stringify({
        at: Date.now(),
        source: (data as any)?.source ?? "unknown",
        fetched: !!(data as any)?.fetched,
        streams: normStreams,
        laps: Array.isArray((data as any)?.laps) ? (data as any).laps : [],
        splits: Array.isArray((data as any)?.splits)
          ? (data as any).splits
          : [],
      }),
    );
  } catch {}
}

function loadExtras(activityId: number): ActivityExtrasCombined | null {
  if (!hasSesssioStorage()) return null;
  try {
    const raw = sessionStorage.getItem(extrasKey(activityId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    const streams = normalizeStreams(parsed?.streams) ?? null;
    const laps = Array.isArray(parsed?.laps) ? parsed.laps : [];
    const splits = Array.isArray(parsed?.splits) ? parsed.splits : [];

    return {
      streams: streams as any,
      laps,
      splits,
      source: String(parsed?.source ?? "unknown"),
      fetched: !!parsed?.fetched,
    } as any;
  } catch {
    return null;
  }
}

/* ------------------------------ cache helpers (Last / Today bundle) ------------------------------ */

export type ActivityBundleNormalized = {
  summary: ActivityRow | null;
  enrichment: ActivityEnrichment | null;
  streams: StreamsData | null;
  laps: any[];
  splits: any[];
};

function normalizeBundle(raw: any): ActivityBundleNormalized {
  return {
    summary: raw?.summary ?? null,
    enrichment: raw?.enrichment ?? null,
    streams: normalizeStreams(raw?.streams) ?? null,
    laps: Array.isArray(raw?.laps) ? raw.laps : [],
    splits: Array.isArray(raw?.splits) ? raw.splits : [],
  };
}

function saveLastActivity(
  userId: number,
  data: ActivityBundleNormalized | null,
) {
  if (!hasSesssioStorage()) return;
  try {
    sessionStorage.setItem(
      lastActivityKey(userId),
      JSON.stringify({ at: Date.now(), data }),
    );
  } catch {}
}

function loadLastActivity(userId: number): ActivityBundleNormalized | null {
  if (!hasSesssioStorage()) return null;
  try {
    const raw = sessionStorage.getItem(lastActivityKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.data ?? null;
  } catch {
    return null;
  }
}

function saveTodayActivities(
  userId: number,
  dateIso: string,
  data: ActivityBundleNormalized[],
) {
  if (!hasSesssioStorage()) return;
  try {
    sessionStorage.setItem(
      todayActivitiesKey(userId, dateIso),
      JSON.stringify({ at: Date.now(), data }),
    );
  } catch {}
}

function loadTodayActivities(
  userId: number,
  dateIso: string,
): ActivityBundleNormalized[] | null {
  if (!hasSesssioStorage()) return null;
  try {
    const raw = sessionStorage.getItem(todayActivitiesKey(userId, dateIso));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.data) ? parsed.data : null;
  } catch {
    return null;
  }
}

/* ------------------------------ helpers ------------------------------ */

function toCsvSportParam(
  s: string | string[] | null | undefined,
): string | null {
  if (s == null) return null;
  if (Array.isArray(s)) {
    const list = s.map((x) => String(x).trim()).filter(Boolean);
    return list.length ? list.join(",") : "all";
  }
  const raw = String(s).trim();
  if (!raw || raw.toLowerCase() === "all") return "all";
  const list = raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  return list.length ? list.join(",") : "all";
}

function toIsoDateLocal(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function monthKey(year: number, month0: number): string {
  return `${year}-${String(month0 + 1).padStart(2, "0")}`;
}

/** Lokálny dátum (YYYY-MM-DD) aktivity - `date` je timestamptz z DB. */
function localDateOf(date: unknown): string {
  try {
    let safeDateStr = String(date).replace(" ", "T");
    if (safeDateStr.endsWith("+00")) safeDateStr += ":00";

    const dateObj = new Date(safeDateStr);
    if (isNaN(dateObj.getTime())) return String(date).slice(0, 10);

    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
    const dd = String(dateObj.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return String(date).slice(0, 10);
  }
}

/* ------------------------------ Context ------------------------------ */

type FetchOpts = { fetch?: boolean };

export type ActivityExtras = {
  streams: StreamsData | null;
  laps: any[];
  splits: any[];
  source?: string;
  fetched?: boolean;
};

type Ctx = {
  rangeStart: string;
  rangeEnd: string;
  rows: ActivityRow[];
  weeks: WeekRow[];
  loading: boolean;

  refresh: (force?: boolean) => Promise<void>;
  selectByRange: (start: string, end: string) => ActivityRow[];
  getSummary: (activityId: number) => ActivityRow | null;

  getExtras: (activityId: number, opts?: FetchOpts) => Promise<ActivityExtras>;
  getEnrichment: (
    activityId: number,
    opts?: FetchOpts,
  ) => Promise<ActivityEnrichment | null>;

  // 🌟 nové: bundle (summary+enrichment+streams+laps+splits) pre
  // WidgetLastActivity / WidgetTodayActivities, rovnaký cache pattern ako
  // getExtras/getEnrichment vyššie.
  getLastActivity: (
    opts?: FetchOpts,
  ) => Promise<ActivityBundleNormalized | null>;
  getTodayActivities: (opts?: FetchOpts) => Promise<ActivityBundleNormalized[]>;

  rolling7: (metric: Metric) => Rolling7;

  getParetoWidget: (
    days: number,
    sport?: string | string[] | null,
  ) => Promise<{
    easy_min: number;
    hard_min: number;
    total_min: number;
    days: number;
  } | null>;

  getParetoTrend: (
    weeks: number,
    sport?: string | string[] | null,
  ) => Promise<ParetoTrendResponse>;

  // 🌟 nové: zabezpečí, že daný mesiac (kalendárny, 1.–posledný deň) je
  // pokrytý v `rows`. Ak je celý v rámci rolling `rangeStart..rangeEnd`,
  // nič sa nedeje. Inak dotiahne len chýbajúci mesiac a zmerguje do rows.
  ensureMonthLoaded: (year: number, month0: number) => Promise<void>;

  /** riadky už načítané v provideri (aj z cache) - dovtedy je rows prázdne */
  rowsLoaded: boolean;
  /**
   * Dnešné aktivity (od najnovšej) - počítané z `rows`, nie z extra requestu.
   * PREČO: /analytics/todayActivities ťahal aj streams/laps/splits, hoci
   * widget ukazuje len názov, šport, vzdialenosť a čas zo summary.
   */
  todayRows: ActivityRow[];

  /*
   * Lenivé zdroje pre activity widgety (aktivuje ich widget cez useEnsure).
   * Sú v cache, zdieľajú request a obnoví ich aj tlačidlo Obnoviť.
   */
  streak: CachedResource<StreakData | null>;
  monthlySummary: CachedResource<MonthlySummary | null>;
  wrappedStatus: CachedResource<ActivitiesWrappedStatus | null>;
  routeOverview: CachedResource<RouteOverviewEntry[]>;
  strengthSessions: CachedResource<StrengthSession[]>;
  /** pareto widget s predvoleným rozsahom (2 týždne, všetky športy) */
  pareto2w: CachedResource<ParetoWidgetData | null>;
  stravaStatus: CachedResource<StravaStatus | null>;
};

export type ParetoWidgetData = {
  easy_min: number;
  hard_min: number;
  total_min: number;
  days: number;
};

/** Predvolený rozsah pareto widgetu, ktorý drží provider (pareto2w). */
export const PARETO_DEFAULT_DAYS = 14;

const ActivityDataContext = createContext<Ctx | null>(null);

export function useActivityData() {
  const ctx = useContext(ActivityDataContext);
  if (!ctx)
    throw new Error(
      "useActivityData must be used within <ActivityDataProvider>",
    );
  return ctx;
}

/* ------------------------------ Provider ------------------------------ */

export function ActivityDataProvider({
  children,
  days = 90,
}: {
  children: React.ReactNode;
  days?: number;
}) {
  const { userId } = useUserId();
  const uid = userId as number;
  const t = useT();

  const rangeEnd = todayLocalISO();
  const rangeStart = addDaysIso(rangeEnd, -(days - 1));

  // Hlavný rozsah aktivít. Kľúč je podľa počtu dní (nie dátumov), aby sa
  // cache ukázala aj na druhý deň - fetcher si dátumy počíta pri volaní.
  const rangeRes = useCachedResource<ActivityRow[]>({
    key: userId != null ? `act:range:${userId}:${days}` : null,
    fetcher: async () => {
      const end = todayLocalISO();
      const start = addDaysIso(end, -(days - 1));
      try {
        const res = await apiFetchRange(uid, start, end);
        return Array.isArray(res) ? res : (res as any)?.data || [];
      } catch (err: any) {
        const translatedError =
          t(err?.message as any) || t("api.common.fetchFailed");
        toast.error(translatedError);
        throw err;
      }
    },
    eager: true,
  });

  // mesiace mimo rozsahu dotiahnuté kalendárom (ensureMonthLoaded) - držíme
  // ich zvlášť, aby ich refresh hlavného rozsahu neprepísal
  const [extraRows, setExtraRows] = useState<ActivityRow[]>([]);

  const rows = useMemo<ActivityRow[]>(() => {
    const base = rangeRes.data ?? [];
    if (!extraRows.length) return base;
    const merged = new Map<string, ActivityRow>();
    for (const r of extraRows) {
      const id = (r as any)?.activity_id;
      merged.set(id != null ? `id:${id}` : JSON.stringify(r), r);
    }
    for (const r of base) {
      const id = (r as any)?.activity_id;
      merged.set(id != null ? `id:${id}` : JSON.stringify(r), r);
    }
    return Array.from(merged.values());
  }, [rangeRes.data, extraRows]);

  // -------- lenivé zdroje widgetov --------
  const now = new Date();
  const monthKeyNow = monthKey(now.getFullYear(), now.getMonth());

  const streak = useCachedResource<StreakData | null>({
    key: userId != null ? `act:streak:${userId}` : null,
    fetcher: async () => (await apiGetStreak(uid)) ?? null,
  });
  const monthlySummary = useCachedResource<MonthlySummary | null>({
    key: userId != null ? `act:monthly:${userId}:${monthKeyNow}` : null,
    fetcher: async () => {
      const d = new Date();
      return (await apiGetMonthlySummary(uid, d.getFullYear(), d.getMonth() + 1)) ?? null;
    },
  });
  const wrappedStatus = useCachedResource<ActivitiesWrappedStatus | null>({
    key: userId != null ? `act:wrapped:${userId}` : null,
    fetcher: async () => (await apiGetActivitiesWrappedStatus(uid)) ?? null,
  });
  const routeOverview = useCachedResource<RouteOverviewEntry[]>({
    key: userId != null ? `act:routes:${userId}` : null,
    fetcher: async () => (await apiGetRouteOverview(uid)) ?? [],
  });
  const strengthSessions = useCachedResource<StrengthSession[]>({
    key: userId != null ? `act:strength:${userId}` : null,
    fetcher: async () =>
      (await apiListStrengthSessions(uid, { weeks_back: 4, limit: 30 })) ?? [],
  });
  const pareto2w = useCachedResource<ParetoWidgetData | null>({
    key: userId != null ? `act:pareto:${userId}:${PARETO_DEFAULT_DAYS}` : null,
    fetcher: async () => (await apiFetchParetoWidget(uid, PARETO_DEFAULT_DAYS, null)) ?? null,
  });
  // stav Stravy sa necachuje - mení sa práve pri prepojení (návrat zo
  // Stravy = nové načítanie appky) a starý stav by ukázal zlý krok
  const stravaStatus = useCachedResource<StravaStatus | null>({
    key: userId != null ? `act:strava-status:${userId}` : null,
    fetcher: async () => (await apiGetStravaStatus(uid)) ?? null,
    persist: false,
  });

  // ručný refresh (tlačidlo) - zobrazí loading aj keď máme dáta z cache
  const [manualRefreshing, setManualRefreshing] = useState(0);

  const fetchRange = useCallback(
    async (_force = false) => {
      setManualRefreshing((n) => n + 1);
      try {
        await Promise.all([
          rangeRes.refresh(),
          streak.revalidate(),
          monthlySummary.revalidate(),
          wrappedStatus.revalidate(),
          routeOverview.revalidate(),
          strengthSessions.revalidate(),
          pareto2w.revalidate(),
          stravaStatus.revalidate(),
        ]);
      } finally {
        setManualRefreshing((n) => Math.max(0, n - 1));
      }
    },
    [
      rangeRes.refresh,
      streak.revalidate,
      monthlySummary.revalidate,
      wrappedStatus.revalidate,
      routeOverview.revalidate,
      strengthSessions.revalidate,
      pareto2w.revalidate,
      stravaStatus.revalidate,
    ],
  );

  const loading = !rangeRes.loaded || manualRefreshing > 0;

  const todayRows = useMemo<ActivityRow[]>(() => {
    const today = todayLocalISO();
    return rows
      .filter((r) => r?.date && localDateOf(r.date) === today)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [rows]);

  // ------------------------------ ensureMonthLoaded ------------------------------
  // sledovanie, ktoré mesiace už boli explicitne dotiahnuté (a ktoré práve fetchujeme)
  const loadedMonthsRef = useRef<Set<string>>(new Set());
  const inFlightMonthsRef = useRef<Set<string>>(new Set());

  // reset pri zmene používateľa (nové rows, iný kontext)
  useEffect(() => {
    loadedMonthsRef.current.clear();
    inFlightMonthsRef.current.clear();
    setExtraRows([]);
  }, [userId]);

  const ensureMonthLoaded = useCallback(
    async (year: number, month0: number) => {
      if (userId == null) return;

      const key = monthKey(year, month0);

      const firstOfMonth = new Date(year, month0, 1);
      const lastOfMonth = new Date(year, month0 + 1, 0);
      const monthStart = toIsoDateLocal(firstOfMonth);
      const monthEnd = toIsoDateLocal(lastOfMonth);

      // mesiac je celý v rámci globálneho rolling rangeu -> netreba nič robiť
      if (monthStart >= rangeStart && monthEnd <= rangeEnd) return;

      // už dotiahnuté alebo práve prebieha fetch
      if (loadedMonthsRef.current.has(key)) return;
      if (inFlightMonthsRef.current.has(key)) return;

      inFlightMonthsRef.current.add(key);
      try {
        let activities: ActivityRow[];

        const cached = loadRange(userId, monthStart, monthEnd);
        if (cached && Array.isArray(cached)) {
          activities = cached;
        } else {
          const res = await apiFetchRange(userId, monthStart, monthEnd);
          activities = Array.isArray(res) ? res : (res as any)?.data || [];
          saveRange(userId, monthStart, monthEnd, activities);
        }

        setExtraRows((prev) => [...prev, ...activities]);

        loadedMonthsRef.current.add(key);
      } catch (err: any) {
        const translatedError =
          t(err?.message as any) || t("api.common.fetchFailed");
        toast.error(translatedError);
      } finally {
        inFlightMonthsRef.current.delete(key);
      }
    },
    [userId, rangeStart, rangeEnd, t],
  );

  const weeks = useMemo(() => aggregateWeeks(rows), [rows]);

  const selectByRange = useCallback(
    (start: string, end: string) => {
      if (!rows.length) return [];
      // PREČO dátumy a nie celé reťazce: r.date je timestamp a hranice
      // môžu prísť aj s časom (80/20 posielalo „…T14:01:00+00:00“). Textové
      // porovnanie vynechávalo aktivity z posledného dňa týždňa.
      const s0 = String(start).slice(0, 10);
      const e0 = String(end).slice(0, 10);
      return rows.filter((r) => {
        const d = localDateOf(r.date);
        return d >= s0 && d <= e0;
      });
    },
    [rows],
  );

  const getSummary = useCallback(
    (activityId: number) =>
      rows.find((r) => r.activity_id === activityId) ?? null,
    [rows],
  );

  const getExtras = useCallback(
    async (activityId: number, opts?: FetchOpts): Promise<ActivityExtras> => {
      if (userId == null || !activityId)
        return { streams: null, laps: [], splits: [] };

      const fetch = !!opts?.fetch;

      if (!fetch) {
        const cached = loadExtras(activityId);
        if (cached) {
          return {
            streams: (cached as any).streams ?? null,
            laps: (cached as any).laps ?? [],
            splits: (cached as any).splits ?? [],
            source: (cached as any).source,
            fetched: (cached as any).fetched,
          };
        }
      }

      try {
        const res = await apiFetchActivityExtrasCombined(
          userId,
          activityId,
          fetch,
        );

        const normStreams = normalizeStreams((res as any)?.streams) ?? null;

        const out: ActivityExtras = {
          streams: normStreams,
          laps: (res as any)?.laps ?? [],
          splits: (res as any)?.splits ?? [],
          source: (res as any)?.source,
          fetched: (res as any)?.fetched,
        };

        if (!fetch && res) saveExtras(activityId, res);
        return out;
      } catch (err: any) {
        console.error(
          "getExtras Provider fetch error:",
          t(err?.message as any),
        );
        return { streams: null, laps: [], splits: [] };
      }
    },
    [userId, t],
  );

  const getEnrichment = useCallback(
    async (
      activityId: number,
      opts?: FetchOpts,
    ): Promise<ActivityEnrichment | null> => {
      if (userId == null || !activityId) return null;

      const fetch = !!opts?.fetch;

      if (!fetch) {
        const cached = loadEnrichment(activityId);
        if (cached) {
          return cached;
        }
      }

      try {
        const data = await apiGetActivityEnrichment(userId, activityId);

        if (data) {
          saveEnrichment(activityId, data);
        }
        return data;
      } catch (err: any) {
        console.error(
          "[DataProvider] getEnrichment failed:",
          t(err?.message as any),
        );
        return null;
      }
    },
    [userId, t],
  );

  const getLastActivity = useCallback(
    async (opts?: FetchOpts): Promise<ActivityBundleNormalized | null> => {
      if (userId == null) return null;

      const fetch = !!opts?.fetch;

      if (!fetch) {
        const cached = loadLastActivity(userId);
        if (cached) return cached;
      }

      try {
        const raw = await apiGetLastActivityBundle(userId);
        if (!raw) return null;

        const normalized = normalizeBundle(raw);
        saveLastActivity(userId, normalized);
        return normalized;
      } catch (err: any) {
        console.error(
          "[DataProvider] getLastActivity failed:",
          t(err?.message as any),
        );
        return null;
      }
    },
    [userId, t],
  );

  const getTodayActivities = useCallback(
    async (opts?: FetchOpts): Promise<ActivityBundleNormalized[]> => {
      if (userId == null) return [];

      const fetch = !!opts?.fetch;
      const today = todayLocalISO(); // už je importované hore

      if (!fetch) {
        const cached = loadTodayActivities(userId, today);
        if (cached) return cached;
      }

      try {
        const rawList = await apiGetTodayActivitiesBundle(userId);
        const normalized = rawList.map(normalizeBundle);
        saveTodayActivities(userId, today, normalized);
        return normalized;
      } catch (err: any) {
        console.error(
          "[DataProvider] getTodayActivities failed:",
          t(err?.message as any),
        );
        return [];
      }
    },
    [userId, t],
  );

  const rolling7 = useCallback(
    (metric: Metric): Rolling7 => {
      const endLast = todayLocalISO();
      const startPrev = addDaysIso(endLast, -13);

      const dayKeys: string[] = [];
      for (let i = 0; i < 14; i++) {
        dayKeys.push(addDaysIso(startPrev, i));
      }

      const daily = new Map<string, number>(dayKeys.map((k) => [k, 0]));

      if (!Array.isArray(rows)) {
        return createEmptyRolling7(dayKeys);
      }

      for (const r of rows) {
        if (!r || !r.date) continue;

        const localDateString = localDateOf(r.date);

        if (!daily.has(localDateString)) continue;

        let inc = 0;
        if (metric === "time") {
          inc = (Number((r as any).moving_time_s) || 0) / 60;
        } else if (metric === "km") {
          inc = (Number((r as any).distance_m) || 0) / 1000;
        } else {
          const trimp =
            (r as any).trimp_total ??
            ((r as any).trimp_run ?? 0) +
              ((r as any).trimp_ride ?? 0) +
              ((r as any).trimp_strength ?? 0) +
              ((r as any).trimp_mixed ?? 0) +
              ((r as any).trimp_skate ?? 0) +
              ((r as any).trimp_other ?? 0);
          inc = Number(trimp) || 0;
        }

        daily.set(localDateString, (daily.get(localDateString) || 0) + inc);
      }

      const vals = dayKeys.map((k) => daily.get(k) || 0);
      const prevDaily = vals.slice(0, 7);
      const lastDaily = vals.slice(7);

      const sum = (arr: number[]) => {
        const s = arr.reduce((a, b) => a + b, 0);
        return Math.round(s * 10) / 10;
      };

      const mean = (arr: number[]) => (arr.length ? sum(arr) / arr.length : 0);
      const std = (arr: number[]) => {
        if (!arr.length) return 0;
        const m = mean(arr);
        const v = arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length;
        return Math.sqrt(v);
      };
      const mono = (arr: number[]) => {
        const s = std(arr);
        if (s === 0) return arr.every((v) => v === 0) ? null : mean(arr) / 1;
        return mean(arr) / s;
      };
      const strain = (arr: number[]) => {
        const m = mono(arr);
        if (m == null) return null;
        return Math.round(sum(arr) * m * 10) / 10;
      };

      return {
        last: {
          sum: sum(lastDaily),
          mono: mono(lastDaily),
          strain: strain(lastDaily),
          daily: lastDaily,
          range: { start: dayKeys[7], end: dayKeys[13] },
        },
        prev: {
          sum: sum(prevDaily),
          mono: mono(prevDaily),
          strain: strain(prevDaily),
          daily: prevDaily,
          range: { start: dayKeys[0], end: dayKeys[6] },
        },
      };
    },
    [rows],
  );

  const getParetoWidget = useCallback(
    async (daysParam: number, sportSel: string | string[] | null = null) => {
      if (userId == null) return null;
      try {
        const sportCsv = toCsvSportParam(sportSel);
        return await apiFetchParetoWidget(userId, daysParam, sportCsv);
      } catch (err: any) {
        console.error("Pareto widget error:", t(err?.message as any));
        return null;
      }
    },
    [userId, t],
  );

  const getParetoTrend = useCallback(
    async (
      weeksParam: number,
      sportSel: string | string[] | null = null,
    ): Promise<ParetoTrendResponse> => {
      if (userId == null) return { trend: [], availableSports: [] };
      try {
        const sportCsv = toCsvSportParam(sportSel);
        return await apiFetchParetoTrend(userId, weeksParam, sportCsv);
      } catch (err: any) {
        console.error("Pareto trend error:", t(err?.message as any));
        return { trend: [], availableSports: [] };
      }
    },
    [userId, t],
  );

  const value: Ctx = useMemo(
    () => ({
      rangeStart,
      rangeEnd,
      rows,
      weeks,
      loading,
      refresh: fetchRange,
      selectByRange,
      getSummary,
      getExtras,
      getEnrichment,
      getLastActivity,
      getTodayActivities,
      rolling7,
      getParetoWidget,
      getParetoTrend,
      ensureMonthLoaded,
      rowsLoaded: rangeRes.loaded,
      todayRows,
      streak,
      monthlySummary,
      wrappedStatus,
      routeOverview,
      strengthSessions,
      pareto2w,
      stravaStatus,
    }),
    [
      rangeStart,
      rangeEnd,
      rows,
      weeks,
      loading,
      fetchRange,
      selectByRange,
      getSummary,
      getExtras,
      getEnrichment,
      getLastActivity,
      getTodayActivities,
      rolling7,
      getParetoWidget,
      getParetoTrend,
      ensureMonthLoaded,
      rangeRes.loaded,
      todayRows,
      streak,
      monthlySummary,
      wrappedStatus,
      routeOverview,
      strengthSessions,
      pareto2w,
      stravaStatus,
    ],
  );

  return (
    <ActivityDataContext.Provider value={value}>
      {children}
    </ActivityDataContext.Provider>
  );
}

// Fallback funkcia v prípade zlých dát
function createEmptyRolling7(dayKeys: string[]): Rolling7 {
  return {
    last: {
      sum: 0,
      mono: null,
      strain: null,
      daily: [0, 0, 0, 0, 0, 0, 0],
      range: { start: dayKeys[7], end: dayKeys[13] },
    },
    prev: {
      sum: 0,
      mono: null,
      strain: null,
      daily: [0, 0, 0, 0, 0, 0, 0],
      range: { start: dayKeys[0], end: dayKeys[6] },
    },
  };
}
