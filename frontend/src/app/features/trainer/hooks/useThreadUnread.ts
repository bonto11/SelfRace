"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  apiGetTrainerUnread,
  apiGetUnreadThreads,
  type TrainerUnreadAthlete,
  type UnreadThread,
} from "@/app/features/trainer/api/sessionMessages";

/*
 * Neprečítané správy vo vláknach k tréningom: bodka na karte tréningu,
 * bodka v kalendári a ikonka v hlavičke. Jeden zdieľaný stav – inak by
 * každá karta a každý deň v kalendári poslal vlastný request. Nie je to
 * widget, preto nie data provider.
 *
 * Dva zdroje:
 *  - threads: vlákna prezeraného usera (atlét sám, alebo zverenec, ktorého
 *    tréner práve prezerá) – userId z useUserId,
 *  - trainer: tréner mimo prezerania – súhrn cez všetkých jeho zverencov.
 *
 * PREČO dva TTL: user bez trénera/zverencov (BE vráti enabled=false) sa
 * nemusí pýtať každú minútu – správy mu nemá kto poslať.
 */
const ENABLED_TTL_MS = 60_000;
const DISABLED_TTL_MS = 30 * 60_000;

type Slot<T> = { userId: number | null; enabled: boolean; data: T; fetchedAt: number };

let threads: Slot<UnreadThread[]> = { userId: null, enabled: false, data: [], fetchedAt: 0 };
let trainer: Slot<TrainerUnreadAthlete[]> = { userId: null, enabled: false, data: [], fetchedAt: 0 };
let threadsInFlight: Promise<void> | null = null;
let trainerInFlight: Promise<void> | null = null;
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

function stale<T>(slot: Slot<T>, userId: number) {
  const ttl = slot.enabled ? ENABLED_TTL_MS : DISABLED_TTL_MS;
  return slot.userId !== userId || Date.now() - slot.fetchedAt >= ttl;
}

function ensureThreads(userId: number) {
  if (!stale(threads, userId) || threadsInFlight) return;
  threadsInFlight = apiGetUnreadThreads(userId)
    .then((res) => {
      threads = { userId, enabled: res.enabled, data: res.threads, fetchedAt: Date.now() };
      emit();
    })
    .finally(() => {
      threadsInFlight = null;
    });
}

function ensureTrainer(userId: number) {
  if (!stale(trainer, userId) || trainerInFlight) return;
  trainerInFlight = apiGetTrainerUnread(userId)
    .then((res) => {
      trainer = { userId, enabled: res.enabled, data: res.athletes, fetchedAt: Date.now() };
      emit();
    })
    .finally(() => {
      trainerInFlight = null;
    });
}

function samePlan(t: UnreadThread, planId?: number | string | null) {
  return planId != null && Number(planId) > 0 && t.plan_id === Number(planId);
}

function sameActivity(t: UnreadThread, activityId?: number | null) {
  return activityId != null && Number(activityId) > 0 && t.activity_id === Number(activityId);
}

/** Po otvorení vlákna (BE ho označil ako prečítané) zhasnú bodky hneď. */
export function markThreadRead(planId?: number | string | null, activityId?: number | null) {
  const next = threads.data.filter((t) => !(samePlan(t, planId) || sameActivity(t, activityId)));
  if (next.length === threads.data.length) return;
  threads = { ...threads, data: next };
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

const getVersion = () => version;

export function useThreadUnread() {
  const { userId, ownUserId, trainerView } = useUserId();
  useSyncExternalStore(subscribe, getVersion, () => 0);

  useEffect(() => {
    if (userId) ensureThreads(Number(userId));
  }, [userId]);

  // súhrn cez zverencov len mimo prezerania – počas neho stačia vlákna zverenca
  useEffect(() => {
    if (ownUserId && !trainerView) ensureTrainer(Number(ownUserId));
  }, [ownUserId, trainerView]);

  const mine = userId && threads.userId === Number(userId) ? threads.data : [];
  const athletes =
    ownUserId && !trainerView && trainer.userId === Number(ownUserId) ? trainer.data : [];

  const hasUnread = useCallback(
    (planId?: number | string | null, activityId?: number | null) =>
      mine.some((t) => samePlan(t, planId) || sameActivity(t, activityId)),
    // version: nová funkcia po každej zmene stavu
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mine, version],
  );

  const hasUnreadOnDate = useCallback(
    (dateIso: string) => mine.some((t) => t.date === dateIso),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mine, version],
  );

  return {
    hasUnread,
    hasUnreadOnDate,
    /** vlákna prezeraného usera, najnovšie prvé */
    threads: mine,
    /** tréner mimo prezerania: zverenci s neprečítanými správami */
    athletes,
    total:
      mine.reduce((n, t) => n + t.count, 0) + athletes.reduce((n, a) => n + a.count, 0),
  };
}
