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

// typ z DB
export type PlannedSession = {
  id: number;
  user_id: number;
  plan_date: string; // YYYY-MM-DD
  sport: string;
  title: string | null;
  duration_min: number | null;
  intensity: string | null;
  session_type: string | null;
  session_index: number | null;
  payload: any;
  activity_id: number | null;
};

type Ctx = {
  rows: PlannedSession[];
  loading: boolean;
  refresh: (force?: boolean) => Promise<void>;
  selectPlanByRange: (start: string, end: string) => PlannedSession[];
};

const PlanDataContext = createContext<Ctx | null>(null);

function hasSS() {
  try {
    return typeof window !== "undefined" && !!window.sessionStorage;
  } catch {
    return false;
  }
}

function rangeKey(userId: number, start: string, end: string) {
  return `PLAN:RANGE:${userId}:${start}:${end}`;
}

function saveRange(userId: number, start: string, end: string, rows: any[]) {
  if (!hasSS()) return;
  try {
    sessionStorage.setItem(rangeKey(userId, start, end), JSON.stringify({ at: Date.now(), rows }));
  } catch {}
}

function loadRange(userId: number, start: string, end: string) {
  if (!hasSS()) return null;
  try {
    const raw = sessionStorage.getItem(rangeKey(userId, start, end));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.rows ?? null;
  } catch {
    return null;
  }
}

export function usePlanData() {
  const ctx = useContext(PlanDataContext);
  if (!ctx) throw new Error("usePlanData must be used inside <PlanDataProvider>");
  return ctx;
}

export function PlanDataProvider({
  children,
  days = 90,
}: {
  children: React.ReactNode;
  days?: number;
}) {
  const { userId } = useUserId();
  const [rows, setRows] = useState<PlannedSession[]>([]);
  const [loading, setLoading] = useState(false);

  const today = new Date();
  const endIso = today.toISOString().slice(0, 10);

  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - (days - 1));
  const startIso = startDate.toISOString().slice(0, 10);

  const doFetch = useCallback(
    async (force: boolean) => {
      if (!userId) return;

      if (!force) {
        const cached = loadRange(userId, startIso, endIso);
        if (cached) {
          setRows(cached);
        }
      }

      setLoading(true);
      try {
        const url = `${API_URL}/coach-plan/${userId}?date_from=${startIso}&date_to=${endIso}`;
        const res = await fetch(url, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        const list = Array.isArray(json?.data) ? json.data : [];

        list.sort((a: any, b: any) => {
          if (a.plan_date === b.plan_date) {
            return (a.session_index ?? 0) - (b.session_index ?? 0);
          }
          return a.plan_date.localeCompare(b.plan_date);
        });

        setRows(list);
        saveRange(userId, startIso, endIso, list);
      } catch (e) {
        console.error("[PLAN][provider] fetch error:", e);
      } finally {
        setLoading(false);
      }
    },
    [userId, startIso, endIso]
  );

  useEffect(() => {
    if (!userId) {
      setRows([]);
      return;
    }
    void doFetch(false);
  }, [userId, doFetch]);

  const refresh = useCallback(
    async (force = true) => {
      await doFetch(force);
    },
    [doFetch]
  );

  const selectPlanByRange = useCallback(
    (start: string, end: string) => {
      return rows.filter((r) => r.plan_date >= start && r.plan_date <= end);
    },
    [rows]
  );

  const value: Ctx = useMemo(
    () => ({
      rows,
      loading,
      refresh,
      selectPlanByRange,
    }),
    [rows, loading, refresh, selectPlanByRange]
  );

  return (
    <PlanDataContext.Provider value={value}>
      {children}
    </PlanDataContext.Provider>
  );
}