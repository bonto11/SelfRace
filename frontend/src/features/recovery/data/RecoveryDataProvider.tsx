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

/* ---------- Nastavenia ---------- */

const DEBUG = true;                 // prepni na false v produkte
const CACHE_VERSION = "v1";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

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

/* ---------- Cache (localStorage + TTL) ---------- */

const hasLS = () => typeof window !== "undefined" && !!window.localStorage;
const ck = (userId: string, days: number) =>
  `recovery:${CACHE_VERSION}:${userId}:${days}`;

function saveCache(userId: string, days: number, rows: RecoveryRow[]) {
  if (!hasLS()) return;
  try {
    localStorage.setItem(
      ck(userId, days),
      JSON.stringify({ savedAt: Date.now(), rows })
    );
    if (DEBUG) console.log("[Recovery][cache] saved", { userId, days, rows: rows.length });
  } catch {}
}

function loadCache(userId: string, days: number):
  | { rows: RecoveryRow[]; fresh: boolean }
  | null {
  if (!hasLS()) return null;
  try {
    const raw = localStorage.getItem(ck(userId, days));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.rows)) return null;
    const fresh = Date.now() - (parsed?.savedAt ?? 0) < CACHE_TTL_MS;
    if (DEBUG) console.log("[Recovery][cache] load", { userId, days, fresh, rows: parsed.rows.length });
    return { rows: parsed.rows as RecoveryRow[], fresh };
  } catch {
    return null;
  }
}

/* ---------- Fetch + normalizácia ---------- */

async function fetchRecovery(userId: string, days = 90): Promise<RecoveryRow[]> {
  const url = `${API_URL}/recovery/${userId}?days=${days}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} :: ${text.slice(0, 200)}`);
  }
  const json = await res.json().catch(() => ({}));
  const arr: any[] = Array.isArray(json?.data) ? json.data : [];

  const rows = arr
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

  if (DEBUG) console.log("[Recovery][fetch] rows", rows.length);
  return rows;
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
  days = 90,
}: {
  children: React.ReactNode;
  days?: number;
}) {
  const { userId } = useUserId(); // číta z cookies – sync
  const userIdStr = useMemo(() => (userId == null ? "" : String(userId)), [userId]);

  const [rows, setRows] = useState<RecoveryRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(
    async (force = false) => {
      if (!userIdStr) return;

      // force: vždy sieť
      if (force) {
        setLoading(true);
        try {
          const fresh = await fetchRecovery(userIdStr, days);
          setRows(fresh);
          saveCache(userIdStr, days, fresh);
        } catch (e: any) {
          if (DEBUG) console.error("[Recovery][refresh(force)]", e?.message ?? e);
        } finally {
          setLoading(false);
        }
        return;
      }

      // normál: najprv cache; ak stale → tichá revalidácia
      const cached = loadCache(userIdStr, days);
      if (cached?.rows?.length) setRows(cached.rows);
      if (cached?.fresh) {
        if (DEBUG) console.log("[Recovery] cache fresh → no network");
        return;
      }

      setLoading(true);
      try {
        const fresh = await fetchRecovery(userIdStr, days);
        setRows(fresh);
        saveCache(userIdStr, days, fresh);
      } catch (e: any) {
        if (DEBUG) console.error("[Recovery][refresh]", e?.message ?? e);
      } finally {
        setLoading(false);
      }
    },
    [userIdStr, days]
  );

  // Init – načítaj cache a (ak treba) ticho revaliduj
  useEffect(() => {
    if (!userIdStr) {
      if (DEBUG) console.log("[Recovery] no userId → skip");
      return;
    }

    const cached = loadCache(userIdStr, days);
    if (cached?.rows?.length) setRows(cached.rows);

    // ak cache nie je fresh, doťahuj
    if (!cached?.fresh) {
      refresh(false).catch(() => {});
    }
  }, [userIdStr, days, refresh]);

  const value = useMemo<CtxValue>(() => ({ rows, loading, refresh }), [rows, loading, refresh]);

  return (
    <RecoveryDataContext.Provider value={value}>
      {children}
    </RecoveryDataContext.Provider>
  );
}