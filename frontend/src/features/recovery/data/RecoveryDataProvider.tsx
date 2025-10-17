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
  const ok = typeof window !== "undefined" && !!window.sessionStorage;
  if (!ok) console.debug("[REC][cache] sessionStorage not available (SSR alebo blokované).");
  return ok;
}

function cacheKey(userId: string, days: number) {
  const key = `RECOVERY:${userId}:${days}`;
  return key;
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
    console.debug("[REC][cache] save", { key, count: rows.length });
  } catch (e) {
    console.warn("[REC][cache] save error:", e);
  }
}

function loadCache(userId: string, days: number): RecoveryRow[] {
  if (!hasSessionStorage()) return [];
  try {
    const key = cacheKey(userId, days);
    const raw = sessionStorage.getItem(key);
    if (!raw) {
      console.debug("[REC][cache] no entry", { key });
      return [];
    }
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed?.rows) ? (parsed.rows as RecoveryRow[]) : [];
    console.debug("[REC][cache] load", { key, count: rows.length, savedAt: parsed?.savedAt });
    return rows;
  } catch (e) {
    console.warn("[REC][cache] load error:", e);
    return [];
  }
}

/* ---------- Fetch + normalizácia ---------- */

async function fetchRecovery(userId: string, days = 90): Promise<RecoveryRow[]> {
  const url = `${API_URL}/recovery/${userId}?days=${days}`;
  const started = performance.now();
  console.debug("[REC][fetch] ->", { url, userId, days });

  try {
    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
      // ak je API za inou doménou a treba CORS cookies, uisti sa, že server povoľuje
      // Access-Control-Allow-Credentials a správne originy.
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    console.debug("[REC][fetch] status", { status: res.status, ok: res.ok });

    const text = await res.text();
    // skúšam parse ručne, nech vieme v logu vidieť raw body pri chybe
    let json: any = {};
    try {
      json = JSON.parse(text);
    } catch (e) {
      console.warn("[REC][fetch] JSON parse error, raw body:", text.slice(0, 500));
      throw e;
    }

    const arr: any[] = Array.isArray(json?.data) ? json.data : [];
    console.debug("[REC][fetch] payload", {
      keys: Object.keys(json || {}),
      dataIsArray: Array.isArray(json?.data),
      dataLen: arr.length,
      sample: arr[0] ? Object.keys(arr[0]) : null,
      tookMs: Math.round(performance.now() - started),
    });

    const normalized = arr
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

    console.debug("[REC][fetch] normalized", {
      count: normalized.length,
      first: normalized[0],
      last: normalized[normalized.length - 1],
    });

    return normalized;
  } catch (e) {
    console.error("[REC][fetch] ERROR", e);
    return [];
  }
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
  const { userId } = useUserId(); // číta sr_id z cookies (client)
  console.debug("[REC][provider] mount, useUserId()", { userId });

  // userId v projekte býva number => bezpečne ho zreťazím na string pre kľúče/cache/fetch
  const userIdStr = useMemo(() => {
    const val = userId == null ? "" : String(userId);
    console.debug("[REC][provider] userIdStr", { userId, userIdStr: val });
    return val;
  }, [userId]);

  const [rows, setRows] = useState<RecoveryRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(
    async (force = false) => {
      if (!userIdStr) {
        console.warn("[REC][refresh] no userIdStr -> skipping");
        return;
      }
      const t0 = performance.now();
      console.debug("[REC][refresh] start", { force, days, userIdStr });

      setLoading(true);
      try {
        // Najprv skús cache (ak nie je force)
        if (!force) {
          const cached = loadCache(userIdStr, days);
          if (cached.length) {
            console.debug("[REC][refresh] cache-hit -> setRows(cached)", { count: cached.length });
            setRows(cached);
            setLoading(false);
          } else {
            console.debug("[REC][refresh] cache-miss");
          }

          // Tichý fetch na pozadí pre aktualizáciu
          fetchRecovery(userIdStr, days)
            .then((fresh) => {
              console.debug("[REC][refresh] background fetch done", { freshCount: fresh.length });
              setRows(fresh);
              saveCache(userIdStr, days, fresh);
            })
            .catch((e) => console.error("[REC][refresh] background fetch ERROR", e));

          console.debug("[REC][refresh] end (non-force)", { tookMs: Math.round(performance.now() - t0) });
          return;
        }

        // Force fetch – okamžite ťahaj z API
        const fresh = await fetchRecovery(userIdStr, days);
        console.debug("[REC][refresh] force fetch done", { freshCount: fresh.length });
        setRows(fresh);
        saveCache(userIdStr, days, fresh);
      } finally {
        setLoading(false);
        console.debug("[REC][refresh] end", { tookMs: Math.round(performance.now() - t0) });
      }
    },
    [userIdStr, days]
  );

  // Init: načítaj cache a spusti tichý refresh
  useEffect(() => {
    console.debug("[REC][effect] init", { userIdStr, days });
    if (!userIdStr) return;

    const cached = loadCache(userIdStr, days);
    if (cached.length) {
      console.debug("[REC][effect] setRows(cached)", { count: cached.length });
      setRows(cached);
    }
    // prvé načítanie: nech je to deterministické -> spravíme force,
    // nech hneď dostaneme najnovšie dáta (a aj ich uložíme do cache)
    refresh(true).catch((e) => console.error("[REC][effect] refresh(true) ERROR", e));
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