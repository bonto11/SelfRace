// src/app/shared/i18n/useT.ts
"use client";

import { useMemo } from "react";
import { useSettings, type AppLang } from "./SettingsProvider";
import { sk } from "./locales/sk";
import { en } from "./locales/en";

export type I18nKey = keyof typeof sk;

const CATALOG: Record<AppLang, Record<string, string>> = {
  sk,
  en,
};

type Vars = Record<string, string | number | null | undefined>;

function format(template: string, vars?: Vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

export function useT() {
  const { lang } = useSettings();

  return useMemo(() => {
    const dict = CATALOG[lang] ?? sk;

    return (key: I18nKey, vars?: Vars) => {
      const raw = dict[key] ?? sk[key] ?? String(key);
      return format(raw, vars);
    };
  }, [lang]);
}