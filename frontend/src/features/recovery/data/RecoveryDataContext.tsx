"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { API_URL } from "@/shared/config";
import { isoDate } from "@/shared/utils/recovery";
import { useUserId } from "@/shared/hooks/useUserId";

/* ----------------------------- Typy a kontext ----------------------------- */

export type RecoveryRow = {
  date: string;                 // YYYY-MM-DD
  RHR_bpm: number | null;
  HRV_avg_ms: number | null;
  HRV_max_ms: number | null;
  sleep_start_time: string | null;   // "HH:MM"
  sleep_duration_min: number | null; // minutes
  comments: string | null;
};

type CtxValue = {
  rows: RecoveryRow[];
  loading: boolean;
  /** Stiahne dáta z API a uloží do cache. Pri force ignoruje cache. */
  refresh: (force?: boolean) => Promise<void>;
};

const RecoveryDataContext = createContext<CtxValue | undefined>(undefined);

/* --------------------------------- Cache --------------------------------- */

const CACHE_VERSION = "v1";
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minút

function cacheKey(userId: string | number, days: number) {
  // kľúč je namespacovaný – aby si mohol mať nezávisle aj activity cache
  return `app:selfrace:${CACHE_VERSION}:recovery:user:${String(userId)}:days:${days}`;
}

function loadCache(userId: string | number, days: number): RecoveryRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(cacheKey(userId, days));
    if (!raw) return [];
    const obj = JSON.parse(raw) as { rows: RecoveryRow[]; expiresAt: number };
    if (!obj || !Array.isArray(obj.rows)) return [];
    if (Date.now() > (obj.expiresAt ?? 0)) {
      sessionStorage.removeItem(cacheKey(userId, days));
      return [];
    }
    return obj.rows;
  } catch {
    return [];
  }
}

function saveCache(userId: string | number, days: number, rows: RecoveryRow[]) {
  if (typeof window === "undefined") return;
  try {
    const payload = JSON.stringify({ rows, expiresAt: Date.now() + CACHE_TTL_MS });
    sessionStorage.setItem(cacheKey(userId, days), payload);
  } catch {
    /* ignore quota errors */
  }
}

/* --------------------------------- Fetch --------------------------------- */

async function fetchRecovery(userId: string | number, days = 90): Promise<RecoveryRow[]> {
  const res = await fetch(`${API_URL}/recovery/${String(userId)}?days=${days}`, {
    credentials: "include",
  });
  const json = await res.json().catch(() => ({} as any));
  const arr: any[] = Array.isArray(json?.data) ? json.data : [];

  return arr
    .map((r) => ({
      date: isoDate(r.date),
      RHR_bpm: r?.RHR_bpm ?? null,
      HRV_avg_ms: r?.HRV_avg_ms ?? null,
      HRV_max_ms: r?.HRV_max_ms ?? null,
      sleep_start_time: r?.sleep_start_time ?? null,
      sleep_duration_min: r?.sleep_duration_min ?? null,
      comments: r?.comments ?? null,
    }))
    .sort((a: RecoveryRow, b: RecoveryRow) => a.date.localeCompare(b.date));
}

/* ------------------------------- Provider -------------------------------- */

export function RecoveryDataProvider({
  children,
  days = 90, // default: 3 mesiace
}: {
  children: React.ReactNode;
  days?: number;
}) {
  const { userId } = useUserId(); // môže byť number | string | null
  const [rows, setRows] = useState<RecoveryRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(
    async (force = false) => {
      if (!userId) return;
      setLoading(true);
      try {
        if (!force) {
          const cached = loadCache(userId, days);
          if (cached.length) {
            setRows(cached);
            setLoading(false);
            // tichý background refresh
            fetchRecovery(userId, days)
              .then((fresh) => {
                setRows(fresh);
                saveCache(userId, days, fresh);
              })
              .catch(() => {});
            return;
          }
        }
        const fresh = await fetchRecovery(userId, days);
        setRows(fresh);
        saveCache(userId, days, fresh);
      } finally {
        setLoading(false);
      }
    },
    [userId, days]
  );

  // init: načítaj cache + sprav tichý refresh
  useEffect(() => {
    if (!userId) return;
    const cached = loadCache(userId, days);
    if (cached.length) setRows(cached);
    refresh(true).catch(() => {});
  }, [userId, days, refresh]);

  return (
    <RecoveryDataContext.Provider value={{ rows, loading, refresh }}>
      {children}
    </RecoveryDataContext.Provider>
  );
}

/* --------------------------------- Hook ---------------------------------- */

export function useRecoveryData(): CtxValue {
  const ctx = useContext(RecoveryDataContext);
  if (!ctx) throw new Error("useRecoveryData must be used within RecoveryDataProvider");
  return ctx;
}