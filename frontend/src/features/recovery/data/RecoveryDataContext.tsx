// src/features/recovery/data/RecoveryDataContext.tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import { toISODateLoose } from "@/shared/utils/recovery"; // už máš v utils

export type RecoveryRow = {
  date: string;
  RHR_bpm?: number | null;
  HRV_avg_ms?: number | null;
  HRV_max_ms?: number | null;
  sleep_start_time?: string | null;
  sleep_duration_min?: number | null;
  comments?: string | null;
};

type Ctx = {
  rows: RecoveryRow[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  // pomocné:
  latestISO: string | null;
  hasToday: boolean;
};

const RecoveryDataContext = createContext<Ctx | null>(null);

export function RecoveryDataProvider({
  children,
  days = 35,
}: {
  children: React.ReactNode;
  days?: number; // koľko dní ťahať
}) {
  const { userId } = useUserId();
  const [rows, setRows] = useState<RecoveryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOnce = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/recovery/${userId}?days=${days}`, {
        cache: "no-store",
        next: { revalidate: 0 },
      });
      const json = await res.json().catch(() => ({}));
      const arr: RecoveryRow[] = Array.isArray(json?.data) ? json.data : [];
      const norm = arr
        .map((r) => ({
          date: toISODateLoose(r.date) ?? "",
          RHR_bpm: r?.RHR_bpm ?? null,
          HRV_avg_ms: r?.HRV_avg_ms ?? null,
          HRV_max_ms: r?.HRV_max_ms ?? null,
          sleep_start_time: r?.sleep_start_time ?? null,
          sleep_duration_min: r?.sleep_duration_min ?? null,
          comments: r?.comments ?? null,
        }))
        .filter((r) => !!r.date)
        .sort((a, b) => a.date.localeCompare(b.date));
      setRows(norm);
    } catch (e: any) {
      setError(e?.message ?? "Fetch failed");
    } finally {
      setLoading(false);
    }
  }, [userId, days]);

  useEffect(() => { fetchOnce(); }, [fetchOnce]);

  // helpery
  const latestISO = useMemo(() => rows.at(-1)?.date ?? null, [rows]);
  const hasToday = useMemo(() => {
    if (!latestISO) return false;
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayIso = `${y}-${m}-${d}`;
    return latestISO === todayIso;
  }, [latestISO]);

  const value: Ctx = {
    rows,
    loading,
    error,
    refresh: fetchOnce,
    latestISO,
    hasToday,
  };

  return (
    <RecoveryDataContext.Provider value={value}>
      {children}
    </RecoveryDataContext.Provider>
  );
}

export function useRecoveryData() {
  const ctx = useContext(RecoveryDataContext);
  if (!ctx) throw new Error("useRecoveryData must be used inside <RecoveryDataProvider>");
  return ctx;
}
