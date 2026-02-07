"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { apiFetchUserPref, apiUpsertUserPref } from "@/app/features/prefs/api/prefs";

export type AppLang = "sk" | "en" | "it" | "esp" | "ger" | "fra";

type SettingsValue = {
  lang: AppLang;
  setLang: (next: AppLang) => Promise<void> | void;
  hydrated: boolean;
};

const SettingsCtx = createContext<SettingsValue | null>(null);

const LS_KEY = "sr_lang";
const DB_KEY = "user.settings"; // { language: "sk" | "en", ... }

function normalizeLang(x: any): AppLang {
  return x === "en" ? "en" : "sk";
}

function readLsLang(): AppLang {
  if (typeof window === "undefined") return "sk";
  try {
    const v = window.localStorage.getItem(LS_KEY);
    return normalizeLang(v);
  } catch {
    return "sk";
  }
}

function writeLsLang(lang: AppLang) {
  try {
    window.localStorage.setItem(LS_KEY, lang);
  } catch {}
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useUserId();

  const [lang, setLangState] = useState<AppLang>("sk");
  const [hydrated, setHydrated] = useState(false);

  // aby sme po prvom fetchi z DB neprepisovali userove kliky
  const didBootstrapRef = useRef(false);

  // 1) bootstrap z localStorage (okamžite po mount)
  useEffect(() => {
    const ls = readLsLang();
    setLangState(ls);
    setHydrated(true);
  }, []);

  // 2) ak je user prihlásený, skús DB (ale rešpektuj localStorage ako "source of truth" pre UI)
  useEffect(() => {
    if (!userId || !hydrated) return;

    let alive = true;

    (async () => {
      try {
        const settings = await apiFetchUserPref(userId, DB_KEY).catch(() => null);
        const dbLang = normalizeLang(settings?.language);

        if (!alive) return;

        // prvý bootstrap: ak LS nemá nič "rozumné", tak vezmi DB
        // (v praxi LS už má default "sk", ale toto je safe)
        if (!didBootstrapRef.current) {
          didBootstrapRef.current = true;

          const ls = readLsLang();
          // ak sa LS a DB líšia, necháme LS (užívateľ mohol prepnúť na landing page)
          // ale môžeme DB zosúladiť na LS (voliteľné) – ja to spravím, aby boli konzistentné
          if (ls !== dbLang) {
            // push LS do DB
            await apiUpsertUserPref(userId, DB_KEY, { ...(settings ?? {}), language: ls }).catch(() => {});
          } else {
            setLangState(ls);
          }
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId, hydrated]);

  const setLang = useCallback(
    async (next: AppLang) => {
      const n = normalizeLang(next);
      setLangState(n);
      writeLsLang(n);

      if (!userId) return;

      // uložiť do DB
      const prev = await apiFetchUserPref(userId, DB_KEY).catch(() => null);
      const merged = { ...(prev ?? {}), language: n };
      await apiUpsertUserPref(userId, DB_KEY, merged);
    },
    [userId],
  );

  const value = useMemo<SettingsValue>(() => ({ lang, setLang, hydrated }), [lang, setLang, hydrated]);

  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsCtx);
  if (!ctx) throw new Error("useSettings must be used within <SettingsProvider>");
  return ctx;
}