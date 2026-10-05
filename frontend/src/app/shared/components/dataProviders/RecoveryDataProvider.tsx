"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { useUserId } from "@/app/shared/hooks/useUserId";
import { RecoveryRow } from "@/app/features/recovery/types/recovery";
import { apiFetchRecovery } from "@/app/features/recovery/api/recovery";
import {
  useCachedResource,
  useEnsure,
  type CachedResource,
} from "@/app/shared/components/dataProviders/useCachedResource";

/* ---------- Typy ---------- */

type CtxValue = {
  rows: RecoveryRow[];
  /** true len keď ešte nemáme žiadne dáta alebo beží ručný refresh */
  loading: boolean;
  refresh: (force?: boolean) => Promise<void>;
};

type InternalCtx = CtxValue & { resource: CachedResource<RecoveryRow[]> };

const EMPTY: RecoveryRow[] = [];

/* ---------- Context ---------- */

const RecoveryDataContext = createContext<InternalCtx | null>(null);

/**
 * Recovery dáta sa načítajú až keď ich niekto použije (recovery stránka,
 * widgety) - pri štarte appky na inej sekcii sa neťahajú.
 */
export function useRecoveryData(): CtxValue {
  const ctx = useContext(RecoveryDataContext);
  if (!ctx) {
    throw new Error("useRecoveryData must be used within RecoveryDataProvider");
  }
  useEnsure(ctx.resource);
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

  const resource = useCachedResource<RecoveryRow[]>({
    key: userId ? `recovery:${userId}:${days}` : null,
    fetcher: () => apiFetchRecovery(String(userId), days),
  });

  const [manualRefreshing, setManualRefreshing] = useState(false);

  const refresh = useCallback(
    async (_force = false) => {
      setManualRefreshing(true);
      try {
        await resource.refresh();
      } finally {
        setManualRefreshing(false);
      }
    },
    [resource.refresh],
  );

  const value = useMemo<InternalCtx>(
    () => ({
      rows: resource.data ?? EMPTY,
      loading: !resource.loaded || manualRefreshing,
      refresh,
      resource,
    }),
    [resource, manualRefreshing, refresh],
  );

  return (
    <RecoveryDataContext.Provider value={value}>
      {children}
    </RecoveryDataContext.Provider>
  );
}
