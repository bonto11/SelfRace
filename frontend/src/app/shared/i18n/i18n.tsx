"use client";

import React, { createContext, useContext, useMemo } from "react";
import sk from "./locales/sk";
import en from "./locales/en";

export type AppLang = "sk" | "en";

const DICTS = { sk, en } as const;

type TFn = (key: string, vars?: Record<string, any>) => string;

function getByPath(obj: any, path: string) {
  return path.split(".").reduce((acc, k) => (acc ? acc[k] : undefined), obj);
}

function formatVars(s: string, vars?: Record<string, any>) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

const I18nCtx = createContext<{ lang: AppLang; t: TFn }>({
  lang: "en",
  t: (k) => k,
});

export function I18nProvider({
  lang,
  children,
}: {
  lang: AppLang;
  children: React.ReactNode;
}) {
  const value = useMemo(() => {
    const dict = DICTS[lang] ?? DICTS.en;

    const t: TFn = (key, vars) => {
      const v = getByPath(dict, key);
      if (typeof v === "string") return formatVars(v, vars);

      const vEn = getByPath(DICTS.en, key);
      if (typeof vEn === "string") return formatVars(vEn, vars);

      return key;
    };

    return { lang, t };
  }, [lang]);

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useT() {
  return useContext(I18nCtx).t;
}