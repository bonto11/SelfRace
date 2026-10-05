"use client";

import { useMemo, useSyncExternalStore } from "react";
import { getSupabaseBrowser } from "@/app/shared/utils/supabaseBrowser";
import { callBackend } from "@/app/shared/utils/callBackend";

/*
 * Jeden spoločný stav prihláseného usera pre celú appku.
 *
 * PREČO store a nie useState v hooku: useUserId používa ~90 komponentov.
 * Predtým si každý sám volal getSession(), registroval vlastný
 * onAuthStateChange a pri chýbajúcej session čakal 800 ms. Pri štarte to
 * bolo desiatky paralelných kontrol a kým každá nedobehla, widget nič
 * nenačítal. Teraz sa session zistí raz a všetci dostanú rovnakú hodnotu -
 * pri prechode na inú stránku je userId k dispozícii hneď v prvom rendri.
 *
 * Session samotnú (cookies, štít proti zmazaniu tokenu v supabaseBrowser)
 * tento store nemení - len ju číta.
 */

type AuthState = { id: number | null; uuid: string | null; isChecking: boolean };

const NUMERIC_ID_KEY = "selfrace_numeric_id";
// ku ktorému auth userovi numerické id patrí - aby po prihlásení iného
// usera na tom istom zariadení nezostalo id predošlého
const NUMERIC_ID_OWNER_KEY = "selfrace_numeric_id_uuid";

const SERVER_STATE: AuthState = { id: null, uuid: null, isChecking: true };

let state: AuthState = SERVER_STATE;
const listeners = new Set<() => void>();
let started = false;
let generation = 0;

function setState(next: AuthState) {
  if (
    next.id === state.id &&
    next.uuid === state.uuid &&
    next.isChecking === state.isChecking
  ) {
    return;
  }
  state = next;
  listeners.forEach((l) => l());
}

function readNumericId(authUid: string): number | null {
  try {
    const id = Number(window.localStorage.getItem(NUMERIC_ID_KEY)) || null;
    const owner = window.localStorage.getItem(NUMERIC_ID_OWNER_KEY);
    if (id && owner && owner !== authUid) return null;
    if (id && !owner) window.localStorage.setItem(NUMERIC_ID_OWNER_KEY, authUid);
    return id;
  } catch {
    return null;
  }
}

function writeNumericId(authUid: string, id: number) {
  try {
    window.localStorage.setItem(NUMERIC_ID_KEY, String(id));
    window.localStorage.setItem(NUMERIC_ID_OWNER_KEY, authUid);
  } catch {
    /* ignore */
  }
}

async function resolveUser() {
  const gen = ++generation;
  const supabase = getSupabaseBrowser();

  let {
    data: { session },
  } = await supabase.auth.getSession();

  // 🛡️ ANTI-PANIKOVÝ HACK: Ak je session null, počkáme 800ms a skúsime znova
  // (iOS PWA po prebudení niekedy na chvíľu vráti prázdnu session)
  if (!session?.user) {
    await new Promise((res) => setTimeout(res, 800));
    const retry = await supabase.auth.getSession();
    session = retry.data.session;
  }

  if (gen !== generation) return; // medzitým začal novší resolve

  const currentUser = session?.user ?? null;
  if (!currentUser) {
    setState({ id: null, uuid: null, isChecking: false });
    return;
  }

  let numId = readNumericId(currentUser.id);

  if (!numId) {
    try {
      const res = await callBackend<{ success: boolean; user_id?: number }>("/users/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auth_uid: currentUser.id }),
      });
      if (res?.success && res.user_id) {
        numId = res.user_id;
        writeNumericId(currentUser.id, numId);
      }
    } catch (e) {}
  }

  if (gen !== generation) return;
  setState({ id: numId, uuid: currentUser.id, isChecking: false });
}

function ensureStarted() {
  if (started || typeof window === "undefined") return;
  started = true;

  void resolveUser();

  getSupabaseBrowser().auth.onAuthStateChange((event: string) => {
    if (event === "INITIAL_SESSION") return;
    // setTimeout: supabase-js neodporúča volať getSession priamo v callbacku
    // (drží auth lock) - spustíme to až po ňom
    setTimeout(() => void resolveUser(), 0);
  });
}

function subscribe(listener: () => void) {
  ensureStarted();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return state;
}

function getServerSnapshot() {
  return SERVER_STATE;
}

/** Aktuálny stav bez hooku (napr. pre splash). */
export function getAuthState(): AuthState {
  return state;
}

export function useUserId() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return useMemo(
    () => ({
      userId: s.id,
      userUuid: s.uuid,
      isChecking: s.isChecking,
      refresh: () => void resolveUser(),
    }),
    [s.id, s.uuid, s.isChecking],
  );
}
