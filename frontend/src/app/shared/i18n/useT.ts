"use client";

import { useMemo } from "react";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { sk } from "@/app/shared/i18n/locales/sk";
import { en } from "@/app/shared/i18n/locales/en";
import { cs } from "@/app/shared/i18n/locales/cs";
import { normalizeLang } from "@/app/shared/i18n/locale";

const dict = { sk, en, cs } as const;

type Dict = typeof dict;
type Lang = keyof Dict;

// helper: "landing.h1" keys
type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
type Leaves<T> = T extends object
  ? { [K in keyof T]: T[K] extends object ? Join<K & string, Leaves<T[K]>> : K & string }[keyof T]
  : never;

export type TKey = Leaves<Dict["sk"]>;

function getByPath(obj: any, path: string): any {
  return path.split(".").reduce((acc, k) => (acc && typeof acc === "object" ? acc[k] : undefined), obj);
}

export function useT() {
  const { lang } = useSettings();

  return useMemo(() => {
    const l: Lang = normalizeLang(lang) ?? "en";
    return (key: TKey, fallback?: string) => {
      const v = getByPath(dict[l], key);
      if (typeof v === "string") return v;
      // CS je preložená zo SK – chýbajúci kľúč je bližšie slovenčine než angličtine
      if (l === "cs") {
        const vSk = getByPath(dict.sk, key);
        if (typeof vSk === "string") return vSk;
      }
      // fallback na EN
      const v2 = getByPath(dict.en, key);
      if (typeof v2 === "string") return v2;
      return fallback ?? key;
    };
  }, [lang]);
}
/** doplní {{n}} a pod. do preloženého textu */
export function fmt(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
