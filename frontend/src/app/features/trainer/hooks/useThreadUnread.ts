"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

import { useUserId } from "@/app/shared/hooks/useUserId";
import { apiGetUnreadThreads } from "@/app/features/trainer/api/sessionMessages";

/*
 * Neprečítané správy vo vláknach (bodka na karte tréningu). Jeden zdieľaný
 * stav pre všetky karty – inak by každá karta v zozname poslala vlastný
 * request. Nie je to widget, preto nie data provider.
 *
 * PREČO dva TTL: user bez trénera (BE vráti enabled=false) sa nemusí pýtať
 * každú minútu – správy mu nemá kto poslať.
 */
const ENABLED_TTL_MS = 60_000;
const DISABLED_TTL_MS = 30 * 60_000;

type State = {
  userId: number | null;
  enabled: boolean;
  keys: Set<string>;
  fetchedAt: number;
  version: number;
};

let state: State = { userId: null, enabled: false, keys: new Set(), fetchedAt: 0, version: 0 };
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit(next: Partial<State>) {
  state = { ...state, ...next, version: state.version + 1 };
  listeners.forEach((l) => l());
}

export function threadKey(planId?: number | string | null, activityId?: number | null): string {
  if (planId != null && Number(planId) > 0) return `p:${Number(planId)}`;
  if (activityId != null && Number(activityId) > 0) return `a:${Number(activityId)}`;
  return "";
}

function ensureFresh(userId: number) {
  const ttl = state.enabled ? ENABLED_TTL_MS : DISABLED_TTL_MS;
  if (state.userId === userId && Date.now() - state.fetchedAt < ttl) return;
  if (inFlight) return;
  inFlight = apiGetUnreadThreads(userId)
    .then((res) => {
      const keys = new Set<string>();
      res.threads.forEach((t) => {
        const k = threadKey(t.plan_id, t.activity_id);
        if (k) keys.add(k);
      });
      emit({ userId, enabled: res.enabled, keys, fetchedAt: Date.now() });
    })
    .finally(() => {
      inFlight = null;
    });
}

/** Po otvorení vlákna (BE ho označil ako prečítané) zhasne bodka hneď. */
export function markThreadRead(planId?: number | string | null, activityId?: number | null) {
  const k = threadKey(planId, activityId);
  if (!k || !state.keys.has(k)) return;
  const keys = new Set(state.keys);
  keys.delete(k);
  emit({ keys });
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

const getVersion = () => state.version;

export function useThreadUnread() {
  const { userId } = useUserId();
  useSyncExternalStore(subscribe, getVersion, () => 0);

  useEffect(() => {
    if (userId) ensureFresh(Number(userId));
  }, [userId]);

  const hasUnread = useCallback(
    (planId?: number | string | null, activityId?: number | null) => {
      if (!userId || state.userId !== Number(userId)) return false;
      const p = threadKey(planId, null);
      const a = threadKey(null, activityId);
      return (!!p && state.keys.has(p)) || (!!a && state.keys.has(a));
    },
    // version v závislostiach – nová funkcia po každej zmene stavu
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, state.version],
  );

  return { hasUnread };
}
