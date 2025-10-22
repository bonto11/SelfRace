// src/features/activity/data/ActivityDataProvider.tsx
"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import {
  addDays, todayISO, normalizeActivityRow,
  type ActivityRow, type ActivityDetailExtra,
  aggregateWeeks, type WeekRow,
} from "@/features/activity/utils/activity";

/* ---------- typy pre 80/20 ---------- */
export type ParetoWidgetData = { easy_min: number; hard_min: number; total_min: number; days: number };
export type ParetoTrendRow  = { label: string; easy_pct: number; hard_pct: number; easy_min: number; hard_min: number };

/* ---------- sessionStorage helpers ---------- */
const hasSS = () => typeof window !== "undefined" && !!window.sessionStorage;
const rangeKey  = (userId: number, start: string, end: string) => `ACT:RANGE:${userId}:${start}:${end}`;
const detailKey = (activityId: number) => `ACT:DETAIL:${activityId}`;
const paretoWidgetKey = (userId:number, days:number, sport:string|null) => `PARETO:W:${userId}:${days}:${sport||"all"}`;
const paretoTrendKey  = (userId:number, weeks:number, sport:string|null) => `PARETO:T:${userId}:${weeks}:${sport||"all"}`;

/* ---------- cache CRUD (existujúci kód pre activities) ---------- */
function saveRange(userId: number, start: string, end: string, rows: ActivityRow[]) {
  if (!hasSS()) return;
  sessionStorage.setItem(rangeKey(userId, start, end), JSON.stringify({ at: Date.now(), rows }));
}
function loadRange(userId: number, start: string, end: string): ActivityRow[] | null {
  if (!hasSS()) return null;
  const raw = sessionStorage.getItem(rangeKey(userId, start, end));
  if (!raw) return null;
  try { const j = JSON.parse(raw); return Array.isArray(j?.rows) ? j.rows as ActivityRow[] : null; } catch { return null; }
}
function saveDetail(activityId: number, extra: ActivityDetailExtra) {
  if (!hasSS()) return;
  sessionStorage.setItem(detailKey(activityId), JSON.stringify({ at: Date.now(), ...extra }));
}
function loadDetail(activityId: number): ActivityDetailExtra | null {
  if (!hasSS()) return null;
  const raw = sessionStorage.getItem(detailKey(activityId));
  if (!raw) return null;
  try { const j = JSON.parse(raw); return { laps: j?.laps ?? [], splits: j?.splits ?? [] }; } catch { return null; }
}

/* ---------- Context ---------- */
type Ctx = {
  rangeStart: string; rangeEnd: string;
  rows: ActivityRow[]; weeks: WeekRow[];
  loading: boolean; refresh: (force?: boolean) => Promise<void>;
  selectByRange: (start: string, end: string) => ActivityRow[];
  getSummary: (activityId: number) => ActivityRow | null;
  getDetail: (activityId: number) => Promise<ActivityDetailExtra>;
  /* nové: 80/20 */
  getParetoWidget: (days: number, sport?: string | null) => Promise<ParetoWidgetData | null>;
  getParetoTrend:  (weeks: number, sport?: string | null) => Promise<ParetoTrendRow[]>;
};
const ActivityDataContext = createContext<Ctx | null>(null);
export const useActivityData = () => {
  const ctx = useContext(ActivityDataContext);
  if (!ctx) throw new Error("useActivityData must be used within <ActivityDataProvider>");
  return ctx;
};

/* ---------- Provider ---------- */
export function ActivityDataProvider({ children, days = 90 }: { children: React.ReactNode; days?: number; }) {
  const { userId } = useUserId();
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);

  const rangeEnd = todayISO();
  const rangeStart = addDays(rangeEnd, -(days - 1));

  /* ---- fetch summary range ---- */
  const doFetch = async (uid: number, start: string, end: string) => {
    const url = `${API_URL}/activities/range/${uid}?start=${start}&end=${end}`;
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    const list: any[] =
      Array.isArray(json?.data) ? json.data :
      Array.isArray(json?.rows) ? json.rows : [];
    const norm = (list as any[]).map(normalizeActivityRow).filter(Boolean) as ActivityRow[];
    norm.sort((a, b) => a.date.localeCompare(b.date));
    setRows(norm);
    saveRange(uid, start, end, norm);
  };

  const refresh = useCallback(async (force = false) => {
    if (userId == null) return;
    setLoading(true);
    try {
      if (!force) {
        const cached = loadRange(userId, rangeStart, rangeEnd);
        if (cached) setRows(cached);
        await doFetch(userId, rangeStart, rangeEnd);
      } else {
        await doFetch(userId, rangeStart, rangeEnd);
      }
    } finally { setLoading(false); }
  }, [userId, rangeStart, rangeEnd]);

  useEffect(() => { if (userId != null) { const c = loadRange(userId, rangeStart, rangeEnd); if (c) setRows(c); void refresh(true); } }, [userId]);

  const weeksAgg = useMemo(() => aggregateWeeks(rows), [rows]);

  const selectByRange = useCallback((start: string, end: string) => rows.filter(r => r.date >= start && r.date <= end), [rows]);
  const getSummary    = useCallback((id: number) => rows.find(r => r.activity_id === id) ?? null, [rows]);

  const getDetail = useCallback(async (activityId: number) => {
    const c = loadDetail(activityId); if (c) return c;
    const res = await fetch(`${API_URL}/activities/detail/${activityId}`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    const extra: ActivityDetailExtra = { laps: Array.isArray(json?.laps) ? json.laps : [], splits: Array.isArray(json?.splits) ? json.splits : [] };
    saveDetail(activityId, extra); return extra;
  }, []);

  /* ---- NOVÉ: 80/20 helpers s cache ---- */
  const getParetoWidget = useCallback(async (daysParam: number, sport: string | null = null) => {
    if (userId == null) return null;
    const key = paretoWidgetKey(userId, daysParam, sport);
    if (hasSS()) {
      const raw = sessionStorage.getItem(key);
      if (raw) { try { const j = JSON.parse(raw); if (j && typeof j.easy_min === "number") return j as ParetoWidgetData; } catch {} }
    }
    const qs = new URLSearchParams({ days: String(daysParam) });
    if (sport) qs.set("sport", sport);
    const res = await fetch(`${API_URL}/analytics/pareto8020/widget/${userId}?${qs.toString()}`, { cache: "no-store" });
    const js = await res.json().catch(() => ({}));
    const data: ParetoWidgetData | null = js?.success ? js?.data ?? null : null;
    if (data && hasSS()) sessionStorage.setItem(key, JSON.stringify(data));
    return data;
  }, [userId]);

  const getParetoTrend = useCallback(async (weeksParam: number, sport: string | null = null) => {
    if (userId == null) return [];
    const key = paretoTrendKey(userId, weeksParam, sport);
    if (hasSS()) {
      const raw = sessionStorage.getItem(key);
      if (raw) { try { const j = JSON.parse(raw); if (Array.isArray(j)) return j as ParetoTrendRow[]; } catch {} }
    }
    const qs = new URLSearchParams({ weeks: String(weeksParam) });
    if (sport) qs.set("sport", sport);
    const res = await fetch(`${API_URL}/analytics/pareto8020/${userId}?${qs.toString()}`, { cache: "no-store" });
    const js  = await res.json().catch(() => ({}));
    const rows: ParetoTrendRow[] = Array.isArray(js?.data) ? js.data : [];
    if (hasSS()) sessionStorage.setItem(key, JSON.stringify(rows));
    return rows;
  }, [userId]);

  const value = useMemo(() => ({
    rangeStart, rangeEnd, rows, weeks: weeksAgg, loading,
    refresh, selectByRange, getSummary, getDetail,
    getParetoWidget, getParetoTrend,
  }), [rangeStart, rangeEnd, rows, weeksAgg, loading, refresh, selectByRange, getSummary, getDetail, getParetoWidget, getParetoTrend]);

  return <ActivityDataContext.Provider value={value}>{children}</ActivityDataContext.Provider>;
}