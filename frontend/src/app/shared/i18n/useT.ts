"use client";

import { useMemo } from "react";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { sk } from "@/app/shared/i18n/locales/sk";
import { en } from "@/app/shared/i18n/locales/en";

const dict = { sk, en } as const;

type Dict = typeof dict;
type Lang = keyof Dict;

// helper: "landing.h1" keys
type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
type Leaves<T> = T extends object
  ? { [K in keyof T]: T[K] extends object ? Join<K & string, Leaves<T[K]>> : K & string }[keyof T]
  : never;

export type TKey = Leaves<Dict["en"]>;

function getByPath(obj: any, path: string): any {
  return path.split(".").reduce((acc, k) => (acc && typeof acc === "object" ? acc[k] : undefined), obj);
}

export function useT() {
  const { lang } = useSettings();

  return useMemo(() => {
    const l: Lang = (lang === "sk" ? "sk" : "en");
    return (key: TKey, fallback?: string) => {
      const v = getByPath(dict[l], key);
      if (typeof v === "string") return v;
      // fallback na EN ak SK chýba
      const v2 = getByPath(dict.en, key);
      if (typeof v2 === "string") return v2;
      return fallback ?? key;
    };
  }, [lang]);
}