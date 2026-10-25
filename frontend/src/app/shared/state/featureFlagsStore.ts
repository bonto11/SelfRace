// src/app/shared/state/featureFlagsStore.ts
"use client";

import { useEffect, useSyncExternalStore } from "react";
import { callBackend } from "@/app/shared/utils/callBackend";
import { beginBootLoad } from "@/app/shared/state/bootLoadStore";
import { useUserId } from "@/app/shared/hooks/useUserId";

/*
 * Prepínače nových funkcií (BE `Configs/features.py`, admin panel → Funkcie):
 * off → admin → beta → všetci. Rozpracovaná funkcia je predvolene len pre
 * admina – ostatní ju nevidia v menu, v sekciách ani v Mojich widgetoch.
 *
 * Platia pre prihláseného usera (ownUserId) – počas prezerania zverenca
 * tréner vidí funkcie podľa seba. Skrytie je len vzhľad, BE si funkciu
 * overuje sám.
 *
 * Hneď z localStorage (kľúč s userId), BE na pozadí raz za načítanie appky.
 * Kým nie je známe nič, je funkcia vypnutá – nič neprebliká.
 *
 * Nová funkcia = kľúč v `FEATURES` na BE + tu vo FeatureKey.
 */

export type FeatureKey = "trainer" | "nutrition" | "session_suggest";

export type FeatureFlags = Partial<Record<FeatureKey, boolean>>;

type Status = "idle" | "local" | "synced" | "error";
/** cached = flags z localStorage (BE ešte nepovedal) */
type State = { userId: number | null; flags: FeatureFlags; status: Status; cached: boolean };

const lsKey = (userId: number) => `sr:features:v1:${userId}`;

let state: State = { userId: null, flags: {}, status: "idle", cached: false };
const listeners = new Set<() => void>();

function setState(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

function parseFlags(raw: unknown): FeatureFlags {
  const out: FeatureFlags = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "boolean") out[k as FeatureKey] = v;
  }
  return out;
}

function readLocal(userId: number): FeatureFlags | null {
  try {
    const raw = window.localStorage.getItem(lsKey(userId));
    return raw ? parseFlags(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeLocal(userId: number, flags: FeatureFlags) {
  try {
    window.localStorage.setItem(lsKey(userId), JSON.stringify(flags));
  } catch {
    /* súkromné okno */
  }
}

function ensureLoaded(userId: number) {
  if (state.userId === userId && state.status !== "idle") return;

  const local = readLocal(userId);
  setState({ userId, flags: local ?? {}, status: "local", cached: !!local });

  // bez cache počká aj splash – menu by inak sekciu ukázalo až o chvíľu
  const endBoot = local ? null : beginBootLoad();

  void (async () => {
    try {
      const res = await callBackend<{ success?: boolean; data?: { features?: unknown } }>("/features/me");
      if (state.userId !== userId) return;
      const flags = parseFlags(res?.data?.features);
      writeLocal(userId, flags);
      setState({ userId, flags, status: "synced", cached: false });
    } catch (e) {
      console.warn("[features] načítanie zlyhalo", e);
      if (state.userId === userId) setState({ ...state, status: "error" });
    } finally {
      endBoot?.();
    }
  })();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => state;

/**
 * Všetky prepínače prihláseného usera. ready = vieme odpoveď (BE alebo
 * cache) – stránka funkcie podľa toho presmeruje, nie podľa prázdneho stavu.
 */
export function useFeatures(): { flags: FeatureFlags; ready: boolean } {
  const { ownUserId } = useUserId();
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (ownUserId) ensureLoaded(ownUserId);
  }, [ownUserId]);

  const mine = ownUserId != null && s.userId === ownUserId;
  const ready = mine && (s.status === "synced" || s.status === "error" || s.cached);
  return { flags: mine ? s.flags : {}, ready };
}

/** Je funkcia pre prihláseného usera zapnutá? */
export function useFeature(key: FeatureKey): boolean {
  return useFeatures().flags[key] === true;
}
