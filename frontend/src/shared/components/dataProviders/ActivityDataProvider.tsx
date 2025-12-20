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

// --- convert FE input (string | string[] | null) -> CSV string | null
function toCsvSportParam(
  s: string | string[] | null | undefined
): string | null {
  if (s == null) return null; // necháme BE použiť default whitelist
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

// ---- 80/20 cache keys na CSV (nie pole!) ----
function paretoWidgetKey(
  userId: number,
  days: number,
  sportCsv: string | null
) {
  return `PARETO:W:${userId}:${days}:${sportCsv ?? "all"}`;
}
function paretoTrendKey(
  userId: number,
  weeks: number,
  sportCsv: string | null
) {
  return `PARETO:T:${userId}:${weeks}:${sportCsv ?? "all"}`;
}

function saveRange(
  userId: number,
  start: string,
  end: string,
  rows: ActivityRow[]
) {
  if (!hasSS()) return;
  try {
    const key = rangeKey(userId, start, end);
    sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), rows }));
    console.debug("[ACT][cache] saveRange", { key, count: rows.length });
  } catch (e) {
    console.warn("[ACT][cache] saveRange error:", e);
  }
}
function loadRange(
  userId: number,
  start: string,
  end: string
): ActivityRow[] | null {
  if (!hasSS()) return null;
  try {
    const key = rangeKey(userId, start, end);
    const raw = sessionStorage.getItem(key);
    if (!raw) {
      console.debug("[ACT][cache] loadRange miss", { key });
      return null;
    }
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed?.rows)
      ? (parsed.rows as ActivityRow[])
      : [];
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
type StreamsData = {
  time_s: number[];
  hr: (number | null)[];
  duration_s: number;
};
function streamsKey(activityId: number) {
  return `ACT:STREAMS:${activityId}`;
}
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
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/* ------------------------------ Context ------------------------------ */

type RollingMetric = "time" | "km" | "trimp";
type Rolling7 = {
  last: {
    sum: number;
    mono: number | null;
    strain: number | null;
    daily: number[];
    range: { start: string; end: string };
  };
  prev: {
    sum: number;
    mono: number | null;
    strain: number | null;
    daily: number[];
    range: { start: string; end: string };
  };
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
  getDetail: (activityId: number) => Promise<ActivityDetailExtra>;
  getStreams: (activityId: number) => Promise<StreamsData>;
  rolling7: (metric: RollingMetric) => Rolling7;

  // 80/20
  getParetoWidget: (
    days: number,
    sport?: string | string[] | null
  ) => Promise<{
    easy_min: number;
    hard_min: number;
    total_min: number;
    days: number;
  } | null>;
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
  if (!ctx)
    throw new Error(
      "useActivityData must be used within <ActivityDataProvider>"
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
      console.debug("[ACT][provider] fetchRange", {
        force,
        userId,
        rangeStart,
        rangeEnd,
      });

      setLoading(true);
      try {
        if (!force) {
          const cached = loadRange(userId, rangeStart, rangeEnd);
          if (cached) {
            setRows(cached);
            setLoading(false);
          }
          await doFetch(userId, rangeStart, rangeEnd);
          return;
        }
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

  async function doFetch(
    uid: number,
    start: string,
    end: string
  ): Promise<void> {
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
    (activityId: number) =>
      rows.find((r) => r.activity_id === activityId) ?? null,
    [rows]
  );

  const getDetail = useCallback(
    async (activityId: number): Promise<ActivityDetailExtra> => {
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
    },
    []
  );

  const getStreams = useCallback(
    async (activityId: number): Promise<StreamsData> => {
      const cached = loadStreams(activityId);
      if (cached && Array.isArray(cached.time_s)) return cached;

      const url = `${API_URL}/activities/streams/1/${activityId}?fetch=true&max=400`;
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
    },
    []
  );

  /* --------- Rolling 7 dní (z ActivityRow, nie z WeekRow!) --------- */

  const rolling7 = useCallback(
    (metric: RollingMetric): Rolling7 => {
      const endLast = todayISO();
      const startPrev = addDays(endLast, -13);
      const dayKeys: string[] = [];
      for (let i = 0; i < 14; i++) dayKeys.push(addDays(startPrev, i));

      const daily = new Map<string, number>(dayKeys.map((k) => [k, 0]));
      for (const r of rows) {
        const d = r.date.slice(0, 10);
        if (!daily.has(d)) continue;
        let inc = 0;
        if (metric === "time") inc = (Number(r.moving_time_s) || 0) / 60;
        else if (metric === "km") inc = (Number(r.distance_m) || 0) / 1000;
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

  /* --------- 80/20 fetchery s vlastnou cache (CSV) --------- */

  const getParetoWidget = useCallback(
    async (daysParam: number, sportSel: string | string[] | null = null) => {
      if (userId == null) return null;

      const sportCsv = toCsvSportParam(sportSel);
      const key = paretoWidgetKey(userId, daysParam, sportCsv);

      if (hasSS()) {
        const raw = sessionStorage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed && Number.isFinite(parsed.easy_min)) return parsed;
          } catch {}
        }
      }

      const q = new URLSearchParams({ days: String(daysParam) });
      if (sportCsv) q.set("sport", sportCsv);

      const url = `${API_URL}/analytics/pareto8020/widget/${userId}?${q.toString()}`;
      console.debug("[PARETO][provider][widget] ->", { url });

      const res = await fetch(url, { cache: "no-store" });
      const js = await res.json().catch(() => ({}));
      const data = js?.data ?? null;

      if (data && hasSS()) sessionStorage.setItem(key, JSON.stringify(data));
      return data;
    },
    [userId]
  );

  const getParetoTrend = useCallback(
    async (weeksParam: number, sportSel: string | string[] | null = null) => {
      if (userId == null) return [];

      const sportCsv = toCsvSportParam(sportSel);
      const key = paretoTrendKey(userId, weeksParam, sportCsv);

      if (hasSS()) {
        const raw = sessionStorage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
          } catch {}
        }
      }

      const q = new URLSearchParams({ weeks: String(weeksParam) });
      if (sportCsv) q.set("sport", sportCsv);

      const url = `${API_URL}/analytics/pareto8020/${userId}?${q.toString()}`;
      console.debug("[PARETO][provider][trend] ->", { url });

      const res = await fetch(url, { cache: "no-store" });
      const js = await res.json().catch(() => ({}));
      const rws = Array.isArray(js?.data) ? js.data : [];
      if (hasSS()) sessionStorage.setItem(key, JSON.stringify(rws));
      return rws;
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

  return (
    <ActivityDataContext.Provider value={value}>
      {children}
    </ActivityDataContext.Provider>
  );
}
