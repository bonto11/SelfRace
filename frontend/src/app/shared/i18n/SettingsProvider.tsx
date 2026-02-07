"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type AppLang = "sk" | "en" | "fr" | "de" | "es" | "it";

type SettingsCtx = {
  lang: AppLang;
  setLang: (next: AppLang) => void;
};

const SettingsContext = createContext<SettingsCtx | null>(null);

const LS_KEY = "sr.settings.language";

function safeReadLS(): AppLang | null {
  try {
    const v = window.localStorage.getItem(LS_KEY);
    if (v === "sk" || v === "en" || v === "fr" || v === "de" || v === "es" || v === "it") return v;
    return null;
  } catch {
    return null;
  }
}

function guessFromNavigator(): AppLang {
  const raw = (typeof navigator !== "undefined" ? navigator.language : "en").toLowerCase();
  if (raw.startsWith("sk")) return "sk";
  if (raw.startsWith("fr")) return "fr";
  if (raw.startsWith("de")) return "de";
  if (raw.startsWith("es")) return "es";
  if (raw.startsWith("it")) return "it";
  return "en";
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<AppLang>("en");

  // init
  useEffect(() => {
    const fromLS = safeReadLS();
    setLangState(fromLS ?? guessFromNavigator());
  }, []);

  const setLang = (next: AppLang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(LS_KEY, next);
    } catch {}
  };

  const value = useMemo(() => ({ lang, setLang }), [lang]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within <SettingsProvider>");
  return ctx;
}