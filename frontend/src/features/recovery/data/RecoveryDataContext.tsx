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
  date: string;
  RHR_bpm: number | null;
  HRV_avg_ms: number | null;
  HRV_max_ms: number | null;
  sleep_start_time: string | null;
  sleep_duration_min: number | null;
  comments: string | null;
};

type CtxValue = {
  rows: RecoveryRow[];
  loading: boolean;
  refresh: (force?: boolean) => Promise<void>;
};

/* ---------- Pomocné funkcie (cache) ---------- */

function hasSessionStorage() {
  return typeof window !== "undefined" && !!window.sessionStorage;
}

function cacheKey(userId: string, days: number) {
  return `RECOVERY:${userId}:${days}`;
}

function saveCache(userId: string, days: number, rows: RecoveryRow[]) {
  if (!hasSessionStorage()) return;
  try {
    const key = cacheKey(userId, days);
    const payload = JSON.stringify({
      savedAt: Date.now(),
      rows,
    });
    sessionStorage.setItem(key, payload);
  } catch {}
}

function loadCache(userId: string, days: number): RecoveryRow[] {
  if (!hasSessionStorage()) return [];
  try {
    const raw = sessionStorage.getItem(cacheKey(userId, days));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.rows)) return parsed.rows as RecoveryRow[];
  } catch {}
  return [];
}

/* ---------- Fetch + normalizácia ---------- */

async function fetchRecovery(userId: string, days = 90): Promise<RecoveryRow[]> {
  const res = await fetch(`${API_URL}/recovery/${userId}?days=${days}`);
  const json = await res.json().catch(() => ({}));
  const arr: any[] = Array.isArray(json?.data) ? json.data : [];

  return arr
    .map((r) => ({
      date: isoDate(r?.date),
      RHR_bpm: r?.RHR_bpm ?? null,
      HRV_avg_ms: r?.HRV_avg_ms ?? null,
      HRV_max_ms: r?.HRV_max_ms ?? null,
      sleep_start_time: r?.sleep_start_time ?? null,
      sleep_duration_min: r?.sleep_duration_min ?? null,
      comments: r?.comments ?? null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/* ---------- Context ---------- */

const RecoveryDataContext = createContext<CtxValue | null>(null);

export function useRecoveryData(): CtxValue {
  const ctx = useContext(RecoveryDataContext);
  if (!ctx) throw new Error("useRecoveryData must be used within RecoveryDataProvider");
  return ctx;
}

/* ---------- Provider ---------- */

export function RecoveryDataProvider({
  children,
  days = 90, // default: 3 mesiace
}: {
  children: React.ReactNode;
  days?: number;
}) {
  const { userId } = useUserId();
  console.log("RecoveryDataProvider userId: " + userId)
  // userId v projekte býva number => bezpečne ho zreťazím na string pre kľúče/cache/fetch
  const userIdStr = useMemo(() => (userId == null ? "" : String(userId)), [userId]);

  const [rows, setRows] = useState<RecoveryRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(
    async (force = false) => {
      if (!userIdStr) return;
      setLoading(true);
      try {
        // Najprv skús cache (ak nie je force)
        if (!force) {
          const cached = loadCache(userIdStr, days);
          if (cached.length) {
            setRows(cached);
            setLoading(false);
          }
          // Tichý fetch na pozadí pre aktualizáciu
          fetchRecovery(userIdStr, days)
            .then((fresh) => {
              setRows(fresh);
              saveCache(userIdStr, days, fresh);
            })
            .catch(() => {});
          return;
        }

        // Force fetch – okamžite ťahaj z API
        const fresh = await fetchRecovery(userIdStr, days);
        setRows(fresh);
        saveCache(userIdStr, days, fresh);
      } finally {
        setLoading(false);
      }
    },
    [userIdStr, days]
  );

  // Init: načítaj cache a spusti tichý refresh
  useEffect(() => {
    if (!userIdStr) return;
    const cached = loadCache(userIdStr, days);
    if (cached.length) setRows(cached);
    refresh(true).catch(() => {});
  }, [userIdStr, days, refresh]);

  const value = useMemo<CtxValue>(
    () => ({ rows, loading, refresh }),
    [rows, loading, refresh]
  );

  return (
    <RecoveryDataContext.Provider value={value}>
      {children}
    </RecoveryDataContext.Provider>
  );
}