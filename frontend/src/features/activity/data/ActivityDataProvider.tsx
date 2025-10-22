// src/features/activity/data/ActivityDataProvider.tsx
"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import {
  addDays,
  todayISO,
  normalizeActivityRow,
  type ActivityRow,
  type ActivityDetailExtra,
  aggregateWeeks,
  type WeekRow,
} from "@/features/activity/utils/activity";

/* -------------------- Cache helpers (sessionStorage) -------------------- */

function hasSS() {
  try {
    return typeof window !== "undefined" && !!window.sessionStorage;
  } catch {
    return false;
  }
}

function rangeKey(userId: number, start: string, end: string) {
  return `ACT:RANGE:${userId}:${start}:${end}`;
}

function detailKey(activityId: number) {
  return `ACT:DETAIL:${activityId}`;
}

// ---- 80/20 cache keys ----
function paretoWidgetKey(userId: number, days: number, sport: string | null) {
  return `PARETO:W:${userId}:${days}:${sport ?? "all"}`;
}
function paretoTrendKey(userId: number, weeks: number, sport: string | null) {
  return `PARETO:T:${userId}:${weeks}:${sport ?? "all"}`;
}

function saveRange(userId: number, start: string, end: string, rows: ActivityRow[]) {
  if (!hasSS()) return;
  try {
    const key = rangeKey(userId, start, end);
    sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), rows }));
    console.debug("[ACT][cache] saveRange", { key, count: rows.length });
  } catch (e) {
    console.warn("[ACT][cache] saveRange error:", e);
  }
}

function loadRange(userId: number, start: string, end: string): ActivityRow[] | null {
  if (!hasSS()) return null;
  try {
    const key = rangeKey(userId, start, end);
    const raw = sessionStorage.getItem(key);
    if (!raw) {
      console.debug("[ACT][cache] loadRange miss", { key });
      return null;
    }
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed?.rows) ? (parsed.rows as ActivityRow[]) : [];
    console.debug("[ACT][cache] loadRange hit", { key, count: rows.length });
    return rows;
  } catch (e) {
    console.warn("[ACT][cache] loadRange error:", e);
    return null;
  }
}

function saveDetail(activityId: number, extra: ActivityDetailExtra) {
  if (!hasSS()) return;
  try {
    const key = detailKey(activityId);
    sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), ...extra }));
    console.debug("[ACT][cache] saveDetail", {
      key,
      laps: extra.laps?.length ?? 0,
      splits: extra.splits?.length ?? 0,
    });
  } catch (e) {
    console.warn("[ACT][cache] saveDetail error:", e);
  }
}

function loadDetail(activityId: number): ActivityDetailExtra | null {
  if (!hasSS()) return null;
  try {
    const key = detailKey(activityId);
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      laps: Array.isArray(parsed?.laps) ? parsed.laps : [],
      splits: Array.isArray(parsed?.splits) ? parsed.splits : [],
    };
  } catch {
    return null;
  }
}

// --- streams cache (HR) ---
function streamsKey(activityId: number) {
  return `ACT:STREAMS:${activityId}`;
}
type StreamsData = { time_s: number[]; hr: (number | null)[]; duration_s: number };
function saveStreams(activityId: number, data: StreamsData) {
  if (!hasSS()) return;
  try {
    sessionStorage.setItem(streamsKey(activityId), JSON.stringify(data));
  } catch {}
}
function loadStreams(activityId: number): StreamsData | null {
  if (!hasSS()) return null;
  try {
    const raw = sessionStorage.getItem(streamsKey(activityId));
    return raw ? (JSON.parse(raw) as StreamsData) : null;
  } catch {
    return null;
  }
}

/* -------------------- Rolling 7 helpers (monotony/strain) -------------------- */

function groupByDay<T extends "time" | "trimp">(rows: ActivityRow[], metric: T) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = r.date; // ISO "YYYY-MM-DD"
    const inc =
      metric === "time"
        ? (r.time_run_min ?? 0) + (r.time_ride_min ?? 0) + (r.time_strength_min ?? 0) +
          (r.time_mixed_min ?? 0) + (r.time_skate_min ?? 0) + (r.time_other_min ?? 0)
        : (r.trimp_run ?? 0) + (r.trimp_ride ?? 0) + (r.trimp_strength ?? 0) +
          (r.trimp_mixed ?? 0) + (r.trimp_skate ?? 0) + (r.trimp_other ?? 0);

    map.set(key, (map.get(key) ?? 0) + inc);
  }
  return map;
}
function daysRange(endISO: string, days: number) {
  const out: string[] = [];
  const end = new Date(endISO);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
function mean(arr: number[]) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}
function stddev(arr: number[]) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const v = mean(arr.map((x) => (x - m) ** 2));
  return Math.sqrt(v);
}
function computeRolling7(
  rows: ActivityRow[],
  rangeEnd: string,
  metric: "time" | "trimp" = "time"
) {
  const perDay = groupByDay(rows, metric);
  const last7Days = daysRange(rangeEnd, 7);
  const prev7Days = daysRange(rangeEnd, 14).slice(0, 7);

  const last7 = last7Days.map((d) => perDay.get(d) ?? 0);
  const prev7 = prev7Days.map((d) => perDay.get(d) ?? 0);

  const sum7 = last7.reduce((a, b) => a + b, 0);
  const sumPrev = prev7.reduce((a, b) => a + b, 0);

  const avg = mean(last7);
  const sd = stddev(last7);
  const monotony = sd < 1e-6 ? 1 : avg / sd; // clamp pre 1–2 dni
  const strain = sum7 * monotony;

  const toRange = (list: string[]) => ({ start: list[0], end: list[list.length - 1] });

  return {
    last: { sum: sum7, mono: monotony, strain, range: toRange(last7Days) },
    prev: { sum: sumPrev, range: toRange(prev7Days) },
  };
}

/* ------------------------------ Context ------------------------------ */

type Ctx = {
  rangeStart: string;
  rangeEnd: string;
  rows: ActivityRow[];
  weeks: WeekRow[];
  loading: boolean;
  refresh: (force?: boolean) => Promise<void>;
  selectByRange: (start: string, end: string) => ActivityRow[];
  getSummary: (activityId: number) => ActivityRow | null;
  getDetail: (activityId: number) => Promise<ActivityDetailExtra>;
  getStreams: (activityId: number) => Promise<StreamsData>;

  // Rolling 7 dní (pre widgety a indexy záťaže)
  rolling7: (metric?: "time" | "trimp") => {
    last: { sum: number; mono: number; strain: number; range: { start: string; end: string } };
    prev: { sum: number; range: { start: string; end: string } };
  };

  // 80/20
  getParetoWidget: (
    days: number,
    sport?: string | null
  ) => Promise<{ easy_min: number; hard_min: number; total_min: number; days: number } | null>;
  getParetoTrend: (
    weeks: number,
    sport?: string | null
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
  const { userId } = useUserId(); // number | null
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);

  // posledných N dní: [start..today]
  const rangeEnd = todayISO();
  const rangeStart = addDays(rangeEnd, -(days - 1));

  const fetchRange = useCallback(
    async (force = false): Promise<void> => {
      if (userId == null) {
        console.warn("[ACT][provider] no userId -> skip fetchRange");
        setRows([]);
        return;
      }

      const t0 = performance.now();
      console.debug("[ACT][provider] fetchRange", { force, userId, rangeStart, rangeEnd });

      setLoading(true);
      try {
        if (!force) {
          const cached = loadRange(userId, rangeStart, rangeEnd);
          if (cached) {
            setRows(cached);
            setLoading(false);
          }
          // tichý refresh
          await doFetch(userId, rangeStart, rangeEnd);
          return;
        }
        // force fetch
        await doFetch(userId, rangeStart, rangeEnd);
      } finally {
        setLoading(false);
        console.debug("[ACT][provider] fetchRange end", {
          tookMs: Math.round(performance.now() - t0),
        });
      }
    },
    [userId, rangeStart, rangeEnd]
  );

  async function doFetch(uid: number, start: string, end: string): Promise<void> {
    const url = `${API_URL}/activities/range/${uid}?start=${start}&end=${end}`;
    console.debug("[ACT][fetch] ->", url);
    try {
      const res = await fetch(url, { cache: "no-store" });
      const text = await res.text();
      let json: any = {};
      try {
        json = JSON.parse(text);
      } catch (e) {
        console.warn("[ACT][fetch] JSON parse error, raw:", text.slice(0, 400));
        throw e;
      }
      const list: any[] = Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json?.rows)
        ? json.rows
        : [];

      const norm = (list as any[])
        .map(normalizeActivityRow)
        .filter(Boolean) as ActivityRow[];

      norm.sort((a, b) => a.date.localeCompare(b.date));
      console.debug("[ACT][fetch] normalized", {
        count: norm.length,
        first: norm[0],
        last: norm[norm.length - 1],
      });

      setRows(norm);
      saveRange(uid, start, end, norm);
    } catch (e) {
      console.error("[ACT][fetch] ERROR", e);
    }
  }

  // init: cache + tichý refresh
  useEffect(() => {
    if (userId == null) {
      setRows([]);
      return;
    }
    const cached = loadRange(userId, rangeStart, rangeEnd);
    if (cached) setRows(cached);
    void fetchRange(true);
  }, [userId, rangeStart, rangeEnd, fetchRange]);

  const weeks = useMemo(() => {
    const w = aggregateWeeks(rows);
    console.debug("[ACT][weeks] computed", { count: w.length });
    return w;
  }, [rows]);

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

  const getDetail = useCallback(async (activityId: number): Promise<ActivityDetailExtra> => {
    const cached = loadDetail(activityId);
    if (cached) {
      console.debug("[ACT][detail] cache hit", { activityId });
      return cached;
    }
    const url = `${API_URL}/activities/detail/${activityId}`;
    console.debug("[ACT][detail] fetch", { url });
    try {
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      const extra: ActivityDetailExtra = {
        laps: Array.isArray(json?.laps) ? json.laps : [],
        splits: Array.isArray(json?.splits) ? json.splits : [],
      };
      saveDetail(activityId, extra);
      return extra;
    } catch (e) {
      console.error("[ACT][detail] fetch ERROR", e);
      return { laps: [], splits: [] };
    }
  }, []);

  const getStreams = useCallback(async (activityId: number): Promise<StreamsData> => {
    const cached = loadStreams(activityId);
    if (cached && Array.isArray(cached.time_s)) {
      return cached;
    }

    const url = `${API_URL}/activities/streams/${activityId}?fetch=true&max=400`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      const data: StreamsData = {
        time_s: Array.isArray(json?.time_s) ? json.time_s : [],
        hr: Array.isArray(json?.hr) ? json.hr : [],
        duration_s: Number(json?.duration_s) || 0,
      };
      saveStreams(activityId, data);
      return data;
    } catch {
      return { time_s: [], hr: [], duration_s: 0 };
    }
  }, []);

  /* --------- 80/20 fetchery s vlastnou cache --------- */

  const getParetoWidget = useCallback(
    async (daysParam: number, sport: string | null = null) => {
      if (userId == null) return null;

      const key = paretoWidgetKey(userId, daysParam, sport);
      if (hasSS()) {
        const raw = sessionStorage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed && Number.isFinite(parsed.easy_min)) {
              return parsed as { easy_min: number; hard_min: number; total_min: number; days: number };
            }
          } catch {}
        }
      }

      const q = new URLSearchParams({ days: String(daysParam) });
      if (sport) q.set("sport", sport);
      const url = `${API_URL}/analytics/pareto8020/widget/${userId}?${q.toString()}`;
      const res = await fetch(url, { cache: "no-store" });
      const js = await res.json().catch(() => ({}));
      const data = js?.data ?? null;
      if (data && hasSS()) sessionStorage.setItem(key, JSON.stringify(data));
      return data;
    },
    [userId]
  );

  const getParetoTrend = useCallback(
    async (weeksParam: number, sport: string | null = null) => {
      if (userId == null) return [];
      const key = paretoTrendKey(userId, weeksParam, sport);
      if (hasSS()) {
        const raw = sessionStorage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed as any[];
          } catch {}
        }
      }
      const q = new URLSearchParams({ weeks: String(weeksParam) });
      if (sport) q.set("sport", sport);
      const url = `${API_URL}/analytics/pareto8020/${userId}?${q.toString()}`;
      const res = await fetch(url, { cache: "no-store" });
      const js = await res.json().catch(() => ({}));
      const rows = Array.isArray(js?.data) ? js.data : [];
      if (hasSS()) sessionStorage.setItem(key, JSON.stringify(rows));
      return rows;
    },
    [userId]
  );

  /* ---------------- expose rolling7 ---------------- */
  const rolling7 = useCallback(
    (metric: "time" | "trimp" = "time") => computeRolling7(rows, rangeEnd, metric),
    [rows, rangeEnd]
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
      getDetail,
      getStreams,
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
      getDetail,
      getStreams,
      rolling7,
      getParetoWidget,
      getParetoTrend,
    ]
  );

  return <ActivityDataContext.Provider value={value}>{children}</ActivityDataContext.Provider>;
}