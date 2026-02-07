"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { AppLang, UserSettingsV1 } from "./settingsTypes";
import { apiFetchUserPref, apiUpsertUserPref } from "@/app/features/prefs/api/prefs";

type SettingsCtx = {
  settings: UserSettingsV1;
  lang: AppLang;

  // patchuje settings (v1)
  setSettings: (patch: Partial<UserSettingsV1> | ((prev: UserSettingsV1) => UserSettingsV1)) => void;

  // convenience
  setLang: (next: AppLang) => void;

  // DB sync (volá bootstrapper po prihlásení)
  bindUser: (userId: number | null) => void;
  syncFromDb: (userId: number) => Promise<void>;
};

const SettingsContext = createContext<SettingsCtx | null>(null);

// ✅ jediný LS key
const LS_KEY = "sr.settings.v1";

// ✅ defaulty (uprav si ak chceš)
const DEFAULT_SETTINGS: UserSettingsV1 = {
  units: "metric",
  language: "en",
  timezone: "Europe/Bratislava",
  week_start: "Mon",
  date_format: "yyyy-MM-dd",
  time_format_24h: true,
};

function safeReadV1(): UserSettingsV1 | null {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw);

    // jemná validácia
    if (!j || typeof j !== "object") return null;
    const lang = j.language;
    if (lang !== "sk" && lang !== "en") return null;

    return {
      ...DEFAULT_SETTINGS,
      ...j,
      language: lang,
    } as UserSettingsV1;
  } catch {
    return null;
  }
}

function safeWriteV1(v: UserSettingsV1) {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(v));
  } catch {}
}

function guessLang(): AppLang {
  const raw = (typeof navigator !== "undefined" ? navigator.language : "en").toLowerCase();
  return raw.startsWith("sk") ? "sk" : "en";
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettingsState] = useState<UserSettingsV1>(DEFAULT_SETTINGS);

  // kto je prihlásený (len keď bindneš)
  const userIdRef = useRef<number | null>(null);

  // init z LS (alebo navigator)
  useEffect(() => {
    const fromLS = safeReadV1();
    if (fromLS) {
      setSettingsState(fromLS);
      return;
    }
    const boot = { ...DEFAULT_SETTINGS, language: guessLang() as AppLang };
    setSettingsState(boot);
    safeWriteV1(boot);
  }, []);

  const bindUser = useCallback((userId: number | null) => {
    userIdRef.current = userId;
  }, []);

  const setSettings = useCallback(
    (patch: Partial<UserSettingsV1> | ((prev: UserSettingsV1) => UserSettingsV1)) => {
      setSettingsState((prev) => {
        const next =
          typeof patch === "function"
            ? (patch as (p: UserSettingsV1) => UserSettingsV1)(prev)
            : ({ ...prev, ...(patch as Partial<UserSettingsV1>) } as UserSettingsV1);

        // ✅ vždy do LS
        safeWriteV1(next);

        // ✅ ak máme userId, tak aj do DB (best-effort)
        const uid = userIdRef.current;
        if (uid) {
          // neblokuj UI
          void apiUpsertUserPref(uid, "user.settings", next).catch(() => {});
        }

        return next;
      });
    },
    [],
  );

  const setLang = useCallback(
    (next: AppLang) => {
      setSettings({ language: next });
    },
    [setSettings],
  );

  const syncFromDb = useCallback(async (userId: number) => {
    userIdRef.current = userId;
  
    let dbVal: any = null;
    try {
      dbVal = await apiFetchUserPref(userId, "user.settings");
    } catch {
      dbVal = null;
    }
  
    if (!dbVal || typeof dbVal !== "object") {
      // ✅ DB prázdne -> beriem LS alebo default (nie React state)
      const local = safeReadV1() ?? { ...DEFAULT_SETTINGS, language: guessLang() };
      setSettingsState(local);
      safeWriteV1(local);
      await apiUpsertUserPref(userId, "user.settings", local).catch(() => {});
      return;
    }
  
    // ✅ DB má -> DB je source of truth po login
    const merged: UserSettingsV1 = {
      ...DEFAULT_SETTINGS,
      ...dbVal,
      language: dbVal.language === "sk" ? "sk" : "en",
    };
  
    setSettingsState(merged);
    safeWriteV1(merged);
  
    // ❌ toto radšej vyhoď (inak vie spôsobiť race)
    // void apiUpsertUserPref(userId, "user.settings", merged).catch(() => {});
  }, []);

  const value = useMemo<SettingsCtx>(
    () => ({
      settings,
      lang: settings.language,
      setSettings,
      setLang,
      bindUser,
      syncFromDb,
    }),
    [settings, setSettings, setLang, bindUser, syncFromDb],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within <SettingsProvider>");
  return ctx;
}