// src/app/shared/i18n/SettingsProvider.tsx
"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type AppLang = "sk" | "en";

type SettingsCtx = {
  lang: AppLang;
  setLang: (next: AppLang) => Promise<void> | void;
};

const KEY = "sr.lang";

const SettingsContext = createContext<SettingsCtx | null>(null);

function isLang(x: any): x is AppLang {
  return x === "sk" || x === "en";
}

function detectInitialLang(): AppLang {
  // 1) localStorage
  try {
    const v = localStorage.getItem(KEY);
    if (isLang(v)) return v;
  } catch {}

  // 2) browser
  if (typeof navigator !== "undefined") {
    const n = (navigator.language || "").toLowerCase();
    if (n.startsWith("sk")) return "sk";
  }

  // 3) default
  return "en";
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<AppLang>("en");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setLangState(detectInitialLang());
    setHydrated(true);
  }, []);

  const setLang = async (next: AppLang) => {
    if (!isLang(next)) return;
    setLangState(next);

    // always LS (works even when not logged in)
    try {
      localStorage.setItem(KEY, next);
    } catch {}

    // DB sync: rob to až keď je user prihlásený (bootstrapper / protected)
    // Tu zámerne nič nevoláme, aby landing/login fungovali bez DB.
  };

  const value = useMemo(() => ({ lang, setLang }), [lang]);

  // optional: počas hydrácie nech nemrkne jazyk (ak chceš)
  if (!hydrated) return <>{children}</>;

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within <SettingsProvider>");
  return ctx;
}