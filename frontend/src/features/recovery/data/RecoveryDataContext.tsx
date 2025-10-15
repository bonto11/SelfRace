'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { API_URL } from '@/shared/config';
import { useUserId } from '@/shared/hooks/useUserId';
import { isoDate } from '@/shared/utils/recovery';

export type RecoveryRow = {
  date: string;
  RHR_bpm: number | null;
  HRV_avg_ms: number | null;
  HRV_max_ms: number | null;
  sleep_start_time: string | null;   // "HH:MM"
  sleep_duration_min: number | null; // minutes
  comments?: string | null;
};

type Ctx = {
  rows: RecoveryRow[];
  loading: boolean;
  refresh: (force?: boolean) => Promise<void>;
};

const RecoveryDataContext = createContext<Ctx | null>(null);

// ---- sessionStorage cache helpers -------------------------------------------------

const KEY = (userId: string, days: number) => `recovery:u_${userId}:days_${days}`;

function loadCache(userId: string, days: number): RecoveryRow[] {
  try {
    const raw = sessionStorage.getItem(KEY(userId, days));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCache(userId: string, days: number, rows: RecoveryRow[]) {
  try {
    sessionStorage.setItem(KEY(userId, days), JSON.stringify(rows));
  } catch {
    /* ignore quota errors */
  }
}

// ---- fetch & normalize ------------------------------------------------------------

async function fetchRecovery(userId: string, days: number): Promise<RecoveryRow[]> {
  const res = await fetch(`${API_URL}/recovery/${userId}?days=${days}`, { cache: 'no-store' });
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

// ---- Provider ---------------------------------------------------------------------

type ProviderProps = {
  children: React.ReactNode;
  days?: number; // koľko dní držíme v cache; default 90
};

export function RecoveryDataProvider({ children, days = 90 }: ProviderProps) {
  const { userId } = useUserId();
  const [rows, setRows] = useState<RecoveryRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(
    async (force = false) => {
      if (!userId) return;
      setLoading(true);
      try {
        if (!force) {
          // najprv cache
          const cached = loadCache(userId, days);
          if (cached.length) {
            setRows(cached);
            setLoading(false);
            // tichý refresh
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

  // init: načítaj cache + tichý refresh
  useEffect(() => {
    if (!userId) return;
    const cached = loadCache(userId, days);
    if (cached.length) setRows(cached);
    refresh(true).catch(() => {});
  }, [userId, days, refresh]);

  const value = useMemo<Ctx>(() => ({ rows, loading, refresh }), [rows, loading, refresh]);

  return <RecoveryDataContext.Provider value={value}>{children}</RecoveryDataContext.Provider>;
}

// named aj default export (aby nepadali importy)
export default RecoveryDataProvider;

export function useRecoveryData(): Ctx {
  const ctx = useContext(RecoveryDataContext);
  if (!ctx) throw new Error('useRecoveryData must be used within a RecoveryDataProvider');
  return ctx;
}