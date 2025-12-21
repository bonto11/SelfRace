"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useUserId } from "@/app/shared/hooks/useUserId";
import { RecoveryRow } from "@/features/recovery/types/recovery";
import { fetchRecoveryApi } from "@/features/recovery/api/recovery";

/* ---------- Typy ---------- */

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
  } catch (e) {
    console.error("[REC][cache] save error:", e);
  }
}

function loadCache(userId: string, days: number): RecoveryRow[] {
  if (!hasSessionStorage()) return [];
  try {
    const key = cacheKey(userId, days);
    const raw = sessionStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed?.rows)
      ? (parsed.rows as RecoveryRow[])
      : [];
    return rows;
  } catch (e) {
    console.error("[REC][cache] load error:", e);
    return [];
  }
}

/* ---------- Context ---------- */

const RecoveryDataContext = createContext<CtxValue | null>(null);

export function useRecoveryData(): CtxValue {
  const ctx = useContext(RecoveryDataContext);
  if (!ctx) {
    throw new Error("useRecoveryData must be used within RecoveryDataProvider");
  }
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

  const userIdStr = useMemo(
    () => (userId == null ? "" : String(userId)),
    [userId]
  );

  const [rows, setRows] = useState<RecoveryRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(
    async (force = false) => {
      if (!userIdStr) return;

      setLoading(true);
      try {
        if (!force) {
          const cached = loadCache(userIdStr, days);
          if (cached.length) {
            setRows(cached);
            setLoading(false);
          }

          // tichý update z API
          fetchRecoveryApi(userIdStr, days)
            .then((fresh) => {
              setRows(fresh);
              saveCache(userIdStr, days, fresh);
            })
            .catch((e) =>
              console.error("[REC][refresh] background fetch ERROR", e)
            );

          return;
        }

        // force fetch – rovno z API
        const fresh = await fetchRecoveryApi(userIdStr, days);
        setRows(fresh);
        saveCache(userIdStr, days, fresh);
      } catch (e) {
        console.error("[REC][refresh] ERROR", e);
      } finally {
        setLoading(false);
      }
    },
    [userIdStr, days]
  );

  // Init: načítaj cache + sprav force refresh
  useEffect(() => {
    if (!userIdStr) return;

    const cached = loadCache(userIdStr, days);
    if (cached.length) {
      setRows(cached);
    }

    refresh(true).catch((e) =>
      console.error("[REC][effect] refresh(true) ERROR", e)
    );
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
