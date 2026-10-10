// src/app/shared/state/widgetPrefsStore.ts
"use client";

import { useEffect, useSyncExternalStore } from "react";
import { apiFetchUserPref, apiUpsertUserPref } from "@/app/features/prefs/api/prefs";
import { beginBootLoad } from "@/app/shared/state/bootLoadStore";
import {
  WIDGET_PREFS_KEY,
  parseWidgetPrefs,
  type WidgetPrefs,
} from "@/app/shared/widgets/widgetCatalog";

/*
 * Voľba widgetov (profil + zapnuté/vypnuté + Domov) vlastného účtu.
 *
 * Rovnako ako ostatné nastavenia: hneď z localStorage (kľúč s userId –
 * po prihlásení iného usera na tom istom zariadení sa nič nemieša), DB na
 * pozadí. Úvodný výber profilu sa ukáže, len keď DB potvrdí, že voľba
 * neexistuje – inak by na novom zariadení preblikol aj userovi, ktorý si
 * už vybral.
 */

/** idle = nič, local = z localStorage (DB ešte beží), synced = DB odpovedala, error = DB zlyhala */
type Status = "idle" | "local" | "synced" | "error";

type State = { userId: number | null; prefs: WidgetPrefs | null; status: Status };

const lsKey = (userId: number) => `sr:widgets:v1:${userId}`;

let state: State = { userId: null, prefs: null, status: "idle" };
const listeners = new Set<() => void>();
// počet lokálnych zmien – odpoveď DB, ktorá prišla po zmene, ju neprepíše
let localVersion = 0;

function setState(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

function readLocal(userId: number): WidgetPrefs | null {
  try {
    const raw = window.localStorage.getItem(lsKey(userId));
    return raw ? parseWidgetPrefs(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeLocal(userId: number, prefs: WidgetPrefs) {
  try {
    window.localStorage.setItem(lsKey(userId), JSON.stringify(prefs));
  } catch {
    /* súkromné okno – ostane aspoň v DB */
  }
}

function ensureLoaded(userId: number) {
  if (state.userId === userId && state.status !== "idle") return;

  const local = readLocal(userId);
  setState({ userId, prefs: local, status: "local" });

  // Bez cache čaká na DB aj úvodný splash – navigácia by inak na chvíľu
  // ukázala všetky sekcie a potom ich schovala.
  const endBoot = local ? null : beginBootLoad();
  const startVersion = localVersion;

  void (async () => {
    try {
      const dbVal = parseWidgetPrefs(await apiFetchUserPref(userId, WIDGET_PREFS_KEY));
      if (state.userId !== userId) return;
      if (localVersion !== startVersion) {
        setState({ ...state, status: "synced" });
        return;
      }
      if (dbVal) {
        writeLocal(userId, dbVal);
        setState({ userId, prefs: dbVal, status: "synced" });
        return;
      }
      // V DB nič, lokálne áno (napr. zápis pri výbere zlyhal) – dopíšeme.
      if (local) void apiUpsertUserPref(userId, WIDGET_PREFS_KEY, local).catch(() => {});
      setState({ userId, prefs: local, status: "synced" });
    } catch (e) {
      console.warn("[widgetPrefs] načítanie zlyhalo", e);
      if (state.userId === userId) setState({ ...state, status: "error" });
    } finally {
      endBoot?.();
    }
  })();
}

/* Odložený zápis do DB: prepínanie widgetov v nastaveniach je rýchle za
   sebou – jeden request namiesto desiatich (každý zápis navyše označí
   dáta providerov ako staré). */
const SAVE_DELAY_MS = 800;
let pending: { userId: number; prefs: WidgetPrefs; onError?: () => void } | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

function flushPending() {
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = null;
  const p = pending;
  pending = null;
  if (!p) return;
  void apiUpsertUserPref(p.userId, WIDGET_PREFS_KEY, p.prefs).catch((e) => {
    console.error("[widgetPrefs] uloženie zlyhalo", e);
    p.onError?.();
  });
}

// zatvorenie appky počas odloženého zápisu – pošli hneď
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushPending();
  });
}

function applyLocal(userId: number, prefs: WidgetPrefs) {
  localVersion += 1;
  writeLocal(userId, prefs);
  setState({ userId, prefs, status: state.userId === userId ? state.status : "local" });
}

/** Uloží voľbu – hneď lokálne, do DB na pozadí. */
export function saveWidgetPrefs(userId: number, prefs: WidgetPrefs): Promise<void> {
  if (pending?.userId === userId) {
    // novšia voľba prebije odložený zápis
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = null;
    pending = null;
  }
  applyLocal(userId, prefs);
  return apiUpsertUserPref(userId, WIDGET_PREFS_KEY, prefs).catch((e) => {
    console.error("[widgetPrefs] uloženie zlyhalo", e);
    throw e;
  });
}

/** Ako saveWidgetPrefs, ale do DB až po chvíli bez ďalšej zmeny. */
export function saveWidgetPrefsDebounced(userId: number, prefs: WidgetPrefs, onError?: () => void) {
  applyLocal(userId, prefs);
  if (pending && pending.userId !== userId) flushPending();
  pending = { userId, prefs, onError };
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(flushPending, SAVE_DELAY_MS);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

const getSnapshot = () => state;
const SERVER_STATE: State = { userId: null, prefs: null, status: "idle" };
const getServerSnapshot = () => SERVER_STATE;

/**
 * Voľba widgetov pre daný (vlastný) účet.
 * needsSetup = DB potvrdila, že user si ešte profil nevybral (prefs môžu
 * existovať – tréner si mohol najprv nastaviť len pohľad na zverenca).
 */
export function useWidgetPrefs(userId: number | null) {
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (userId) ensureLoaded(userId);
  }, [userId]);

  const mine = !!userId && s.userId === userId;
  return {
    prefs: mine ? s.prefs : null,
    /** voľba je k dispozícii (z cache alebo DB) */
    ready: mine && (s.prefs != null || s.status === "synced" || s.status === "error"),
    needsSetup: mine && s.status === "synced" && !s.prefs?.profile,
  };
}
