// src/app/shared/components/dataProviders/ActivityDataProvider.tsx
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
import { aggregateWeeks } from "@/app/features/activities/utils/activity";
import { addDays, todayISO } from "@/app/shared/utils/time";

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
  type ActivityExtrasCombined,
} from "@/app/features/activities/api/analytics_activities";

import { apiFetchRange } from "@/app/features/activities/api/activities_summary";
import { hasSesssioStorage } from "@/app/shared/utils/sessionStorage";

/* ------------------------------ cache helpers ------------------------------ */

function rangeKey(userId: number, start: string, end: string) {
  return `ACT:RANGE:${userId}:${start}:${end}`;
}
function extrasKey(activityId: number) {
  return `ACT:EXTRAS:v1:${activityId}`;
}

function saveRange(userId: number, start: string, end: string, rows: ActivityRow[]) {
  if (!hasSesssioStorage()) return;
  try {
    sessionStorage.setItem(
      rangeKey(userId, start, end),
      JSON.stringify({ at: Date.now(), rows })
    );
  } catch {}
}

function loadRange(userId: number, start: string, end: string): ActivityRow[] | null {
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

function saveExtras(activityId: number, data: ActivityExtrasCombined) {
  if (!hasSesssioStorage()) return;
  try {
    sessionStorage.setItem(extrasKey(activityId), JSON.stringify({ at: Date.now(), ...data }));
  } catch {}
}

function loadExtras(activityId: number): ActivityExtrasCombined | null {
  if (!hasSesssioStorage()) return null;
  try {
    const raw = sessionStorage.getItem(extrasKey(activityId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    const streams = (parsed?.streams ?? null) as StreamsData | null;
    const laps = Array.isArray(parsed?.laps) ? parsed.laps : [];
    const splits = Array.isArray(parsed?.splits) ? parsed.splits : [];

    return {
      streams,
      laps,
      splits,
      source: String(parsed?.source ?? "unknown"),
      fetched: !!parsed?.fetched,
    };
  } catch {
    return null;
  }
}

/* ------------------------------ helpers ------------------------------ */

function toCsvSportParam(s: string | string[] | null | undefined): string | null {
  if (s == null) return null;
  if (Array.isArray(s)) {
    const list = s.map((x) => String(x).trim()).filter(Boolean);
    return list.length ? list.join(",") : "all";
  }
  const raw = String(s).trim();
  if (!raw || raw.toLowerCase() === "all") return "all";
  const list = raw.split(",").map((x) => x.trim()).filter(Boolean);
  return list.length ? list.join(",") : "all";
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

  // ✅ jediné “detail” API
  getExtras: (activityId: number, opts?: FetchOpts) => Promise<ActivityExtras>;

  rolling7: (metric: Metric) => Rolling7;

  getParetoWidget: (
    days: number,
    sport?: string | string[] | null
  ) => Promise<{ easy_min: number; hard_min: number; total_min: number; days: number } | null>;

  getParetoTrend: (
    weeks: number,
    sport?: string | string[] | null
  ) => Promise<
    Array<{
      label: string;
      easy_min: number;
      hard_min: number;
      easy_pct: number;
      hard_pct: number;
      start?: string;
      end?: string;
    }>
  >;
};

const ActivityDataContext = createContext<Ctx | null>(null);

export function useActivityData() {
  const ctx = useContext(ActivityDataContext);
  if (!ctx) throw new Error("useActivityData must be used within <ActivityDataProvider>");
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
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);

  const rangeEnd = todayISO();
  const rangeStart = addDays(rangeEnd, -(days - 1));

  const fetchRange = useCallback(
    async (force = false) => {
      if (userId == null) {
        setRows([]);
        return;
      }

      if (!force) {
        const cached = loadRange(userId, rangeStart, rangeEnd);
        if (cached) setRows(cached);
      }

      setLoading(true);
      try {
        const norm = await apiFetchRange(userId, rangeStart, rangeEnd);
        setRows(norm);
        saveRange(userId, rangeStart, rangeEnd, norm);
      } finally {
        setLoading(false);
      }
    },
    [userId, rangeStart, rangeEnd]
  );

  useEffect(() => {
    if (userId == null) {
      setRows([]);
      return;
    }
    void fetchRange(false);
  }, [userId, rangeStart, rangeEnd, fetchRange]);

  const weeks = useMemo(() => aggregateWeeks(rows), [rows]);

  const selectByRange = useCallback(
    (start: string, end: string) => {
      if (!rows.length) return [];
      return rows.filter((r) => r.date >= start && r.date <= end);
    },
    [rows]
  );

  const getSummary = useCallback(
    (activityId: number) => rows.find((r) => r.activity_id === activityId) ?? null,
    [rows]
  );

  // ✅ jediný vstup: extras
  const getExtras = useCallback(
    async (activityId: number, opts?: FetchOpts): Promise<ActivityExtras> => {
      if (userId == null || !activityId) return { streams: null, laps: [], splits: [] };

      const fetch = !!opts?.fetch;

      if (!fetch) {
        const cached = loadExtras(activityId);
        if (cached) {
          return {
            streams: cached.streams ?? null,
            laps: cached.laps ?? [],
            splits: cached.splits ?? [],
            source: cached.source,
            fetched: cached.fetched,
          };
        }
      }

      const res = await apiFetchActivityExtrasCombined(userId, activityId, fetch);
      const out: ActivityExtras = {
        streams: (res?.streams ?? null) as StreamsData | null,
        laps: res?.laps ?? [],
        splits: res?.splits ?? [],
        source: res?.source,
        fetched: res?.fetched,
      };

      if (!fetch && res) saveExtras(activityId, res);
      return out;
    },
    [userId]
  );

  const rolling7 = useCallback(
    (metric: Metric): Rolling7 => {
      const endLast = todayISO();
      const startPrev = addDays(endLast, -13);
      const dayKeys: string[] = [];
      for (let i = 0; i < 14; i++) dayKeys.push(addDays(startPrev, i));

      const daily = new Map<string, number>(dayKeys.map((k) => [k, 0]));
      for (const r of rows) {
        const d = r.date.slice(0, 10);
        if (!daily.has(d)) continue;

        let inc = 0;
        if (metric === "time") inc = (Number((r as any).moving_time_s) || 0) / 60;
        else if (metric === "km") inc = (Number((r as any).distance_m) || 0) / 1000;
        else {
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
        daily.set(d, (daily.get(d) || 0) + inc);
      }

      const vals = dayKeys.map((k) => daily.get(k) || 0);
      const prevDaily = vals.slice(0, 7);
      const lastDaily = vals.slice(7);

      const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
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
        return sum(arr) * m;
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
    [rows]
  );

  const getParetoWidget = useCallback(
    async (daysParam: number, sportSel: string | string[] | null = null) => {
      if (userId == null) return null;
      const sportCsv = toCsvSportParam(sportSel);
      return apiFetchParetoWidget(userId, daysParam, sportCsv);
    },
    [userId]
  );

  const getParetoTrend = useCallback(
    async (weeksParam: number, sportSel: string | string[] | null = null) => {
      if (userId == null) return [];
      const sportCsv = toCsvSportParam(sportSel);
      return apiFetchParetoTrend(userId, weeksParam, sportCsv);
    },
    [userId]
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
      rolling7,
      getParetoWidget,
      getParetoTrend,
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
      rolling7,
      getParetoWidget,
      getParetoTrend,
    ]
  );

  return <ActivityDataContext.Provider value={value}>{children}</ActivityDataContext.Provider>;
}