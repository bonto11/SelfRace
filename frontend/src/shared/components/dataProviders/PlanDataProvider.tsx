// src/shared/components/dataProviders/PlanDataProvider.tsx
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
import { todayISO, addDays } from "@/shared/utils/time";

/* ----------------- Typy ----------------- */

export type PlanRow = {
  id: number;
  user_id: number;
  plan_date: string; // "YYYY-MM-DD"
  sport: string;

  title?: string | null;
  duration_min?: number | null;
  intensity?: string | null;
  plan_id?: string | null;
  activity_id?: number | null;
  session_type?: string | null;
  session_index?: number | null;
  payload?: any;
  source?: string | null;

  // legacy / extra polia z DB nechávame otvorené
  [key: string]: any;
};

type PlanCtx = {
  rangeStart: string;
  rangeEnd: string;
  rows: PlanRow[];
  planRows: PlanRow[]; // alias
  loading: boolean;
  hasAnyPlan: boolean;
  refresh: (force?: boolean) => Promise<void>;
  selectPlanByRange: (start: string, end: string) => PlanRow[];
};

const PlanDataContext = createContext<PlanCtx | null>(null);

export function usePlanData(): PlanCtx {
  const ctx = useContext(PlanDataContext);
  if (!ctx) {
    throw new Error("usePlanData must be used inside <PlanDataProvider>");
  }
  return ctx;
}

/* ----------------- Provider ----------------- */

export function PlanDataProvider({
  children,
  pastDays = 90,
  futureDays = 15,
}: {
  children: React.ReactNode;
  pastDays?: number;
  futureDays?: number;
}) {
  const { userId } = useUserId();
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(false);

  // today … minulosť (pastDays-1) … + budúcnosť futureDays
  const today = todayISO();
  const rangeStart = addDays(today, -(pastDays - 1));
  const rangeEnd = addDays(today, futureDays);

  const fetchRange = useCallback(
    async (force = false): Promise<void> => {
      if (userId == null) {
        console.warn("[PLAN][provider] no userId -> skip fetchRange");
        setRows([]);
        return;
      }

      if (!API_URL) {
        console.error("[PLAN][provider] Missing API_URL");
        setRows([]);
        return;
      }

      const t0 = typeof performance !== "undefined" ? performance.now() : 0;

      const url = `${API_URL}/coach-plan/${userId}?date_from=${rangeStart}&date_to=${rangeEnd}`;
      console.debug("[PLAN][fetch] ->", url, {
        force,
        userId,
        rangeStart,
        rangeEnd,
      });

      setLoading(true);
      try {
        const res = await fetch(url, { cache: "no-store" });

        const rawText = await res.text();
        let json: any = {};
        try {
          json = rawText ? JSON.parse(rawText) : {};
        } catch (e) {
          console.warn(
            "[PLAN][fetch] JSON parse error, raw head:",
            rawText.slice(0, 400)
          );
          throw e;
        }

        if (!res.ok) {
          console.error("[PLAN][fetch] HTTP error", res.status, json);
          throw new Error(json?.detail || json?.error || `HTTP ${res.status}`);
        }

        const list: any[] = Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.rows)
          ? json.rows
          : [];

        const norm: PlanRow[] = (list as any[])
          .map((r, idx) => ({
            ...r,
            id: Number(r.id ?? idx),
            user_id: Number(r.user_id ?? userId),
            plan_date: String(r.plan_date).slice(0, 10),
            sport: String(r.sport ?? "other"),
          }))
          .sort((a, b) => a.plan_date.localeCompare(b.plan_date));

        console.debug("[PLAN][fetch] normalized", {
          count: norm.length,
          first: norm[0],
          last: norm[norm.length - 1],
        });

        setRows(norm);
      } catch (e) {
        console.error("[PLAN][fetch] ERROR", e);
        // pri chybe vynulujeme – nech UI radšej vidí “žiadny plán”
        setRows([]);
      } finally {
        setLoading(false);
        if (t0) {
          console.debug("[PLAN][provider] fetchRange end", {
            tookMs: Math.round(performance.now() - t0),
          });
        }
      }
    },
    [userId, rangeStart, rangeEnd]
  );

  // init: keď sa zmení userId / range, načítaj
  useEffect(() => {
    if (userId == null) {
      setRows([]);
      return;
    }
    void fetchRange(true);
  }, [userId, rangeStart, rangeEnd, fetchRange]);

  const selectPlanByRange = useCallback(
    (start: string, end: string): PlanRow[] => {
      if (!rows.length) return [];
      return rows.filter((r) => r.plan_date >= start && r.plan_date <= end);
    },
    [rows]
  );

  const value: PlanCtx = useMemo(
    () => ({
      rangeStart,
      rangeEnd,
      rows,
      planRows: rows,
      loading,
      hasAnyPlan: rows.length > 0,
      refresh: fetchRange,
      selectPlanByRange,
    }),
    [rangeStart, rangeEnd, rows, loading, fetchRange, selectPlanByRange]
  );

  return (
    <PlanDataContext.Provider value={value}>
      {children}
    </PlanDataContext.Provider>
  );
}
