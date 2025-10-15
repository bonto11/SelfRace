// src/features/recovery/data/RecoveryDataContext.tsx
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
import { isoDate } from "@/shared/utils/recovery";

/* ---------- Typy ---------- */

export type RecoveryRow = {
  date: string;                 // YYYY-MM-DD
  RHR_bpm: number | null;
  HRV_avg_ms: number | null;
  HRV_max_ms: number | null;
  sleep_start_time: string | null;   // "HH:MM"
  sleep_duration_min: number | null; // min
  comments: string | null;
};

type RecoveryCtx = {
  rows: RecoveryRow[];
  loading: boolean;
  /** Vynútiť refresh (ak force=true, ignoruje cache). */
  refresh: (force?: boolean) => Promise<void>;
};

const Ctx = createContext<RecoveryCtx | null>(null);

/* ---------- Cache do sessionStorage ---------- */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

function cacheKey(userId: string, days: number) {
  return `recovery:${userId}:d${days}`;
}

function saveCache(userId: string, days: number, rows: RecoveryRow[]) {
  try {
    sessionStorage.setItem(
      cacheKey(userId, days),
      JSON.stringify({ at: Date.now(), rows })
    );
  } catch {}
}

function loadCache(userId: string, days: number): RecoveryRow[] | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(userId, days));
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!Array.isArray(obj?.rows)) return null;
    if (Date.now() - (obj.at ?? 0) > CACHE_TTL_MS) return null; // expirované
    return obj.rows as RecoveryRow[];
  } catch {
    return null;
  }
}

/* ---------- Fetch z BE + normalizácia ---------- */

async function fetchRecovery(userId: string, days: number): Promise<RecoveryRow[]> {
  const res = await fetch(`${API_URL}/recovery/${userId}?days=${days}`, {
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
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
    .sort((a, b) => a.date.localeCompare(b.date));
}

/* ---------- Provider ---------- */

export default function RecoveryDataProvider({
  children,
  days = 90, // predvolene 3 mesiace
}: {
  children: React.ReactNode;
  days?: number;
}) {
  const { userId } = useUserId(); // očakáva string | null
  const [rows, setRows] = useState<RecoveryRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(
    async (force = false) => {
      if (!userId) return;
      setLoading(true);
      try {
        if (!force) {
          const cached = loadCache(userId, days);
          if (cached?.length) {
            setRows(cached);
            setLoading(false);
            // tichý refresh na pozadí
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
    if (cached) setRows(cached);
    refresh(true).catch(() => {});
  }, [userId, days, refresh]);

  const value = useMemo<RecoveryCtx>(
    () => ({ rows, loading, refresh }),
    [rows, loading, refresh]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/* ---------- Hook ---------- */

export function useRecoveryData() {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error("useRecoveryData must be used within RecoveryDataProvider");
  }
  return v;
}