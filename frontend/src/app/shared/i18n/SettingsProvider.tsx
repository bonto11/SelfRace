"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { apiFetchUserPref, apiUpsertUserPref } from "@/app/features/prefs/api/prefs";
import { DEFAULT_SETTINGS, type AppLang, type UserSettings } from "./settingsTypes";

type SettingsCtx = {
  settings: UserSettings;
  lang: AppLang;
  setLang: (next: AppLang) => Promise<void> | void;

  // pre budúcnosť (units, week_start,...)
  updateSettings: (patch: Partial<UserSettings>) => Promise<void> | void;

  // zapne DB sync po prihlásení
  attachUser: (userId: number) => Promise<void>;
  detachUser: () => void;
};

const SettingsContext = createContext<SettingsCtx | null>(null);

const LS_KEY = "sr.user.settings.v1";
const DB_KEY = "user.settings";

function safeReadLS(): Partial<UserSettings> | null {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;
    return obj as Partial<UserSettings>;
  } catch {
    return null;
  }
}

function safeWriteLS(v: UserSettings) {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(v));
  } catch {}
}

function guessFromNavigator(): Partial<UserSettings> {
  let language: AppLang = "en";
  try {
    const raw = (navigator?.language || "en").toLowerCase();
    if (raw.startsWith("sk")) language = "sk";
    else if (raw.startsWith("fr")) language = "fr";
    else if (raw.startsWith("de")) language = "de";
    else if (raw.startsWith("es")) language = "es";
    else if (raw.startsWith("it")) language = "it";
  } catch {}

  let timezone = DEFAULT_SETTINGS.timezone;
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || timezone;
  } catch {}

  return { language, timezone };
}

function mergeSettings(base: UserSettings, patch?: Partial<UserSettings> | null): UserSettings {
  return {
    ...base,
    ...(patch || {}),
    // hard guard
    language: (patch?.language as AppLang) || base.language,
    units: (patch?.units as any) || base.units,
    week_start: (patch?.week_start as any) || base.week_start,
    date_format: patch?.date_format || base.date_format,
    time_format_24h:
      typeof patch?.time_format_24h === "boolean" ? patch.time_format_24h : base.time_format_24h,
    timezone: patch?.timezone || base.timezone,
  };
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  // user binding (DB sync)
  const userIdRef = useRef<number | null>(null);
  const hydratingRef = useRef(false);

  // init from LS (or navigator) once
  useEffect(() => {
    const fromLS = safeReadLS();
    const guessed = guessFromNavigator();
    const initial = mergeSettings(DEFAULT_SETTINGS, { ...guessed, ...(fromLS || {}) });
    setSettings(initial);
    safeWriteLS(initial);
  }, []);

  async function persistToDbIfAuthed(next: UserSettings) {
    const uid = userIdRef.current;
    if (!uid) return;
    try {
      await apiUpsertUserPref(uid, DB_KEY, next);
    } catch (e) {
      // DB fail nech nezabije UX; LS je stále source-of-truth v tomto momente
      console.warn("[Settings] DB save failed", e);
    }
  }

  const updateSettings = async (patch: Partial<UserSettings>) => {
    setSettings((prev) => {
      const next = mergeSettings(prev, patch);
      safeWriteLS(next);
      void persistToDbIfAuthed(next);
      return next;
    });
  };

  const setLang = async (next: AppLang) => {
    await updateSettings({ language: next });
  };

  // po prihlásení: DB -> FE + LS, ak DB prázdne: seed DB z lokálu
  const attachUser = async (userId: number) => {
    userIdRef.current = userId;

    if (hydratingRef.current) return;
    hydratingRef.current = true;

    try {
      const dbVal = (await apiFetchUserPref(userId, DB_KEY)) as Partial<UserSettings> | null;

      // ak DB nemá nič -> seed z aktuálneho FE/LS
      if (!dbVal || typeof dbVal !== "object") {
        const current = settings;
        safeWriteLS(current);
        await persistToDbIfAuthed(current);
        return;
      }

      // DB má niečo -> zmergeuj s lokálom (DB má prioritu, ale nech má vždy jazyk)
      const local = safeReadLS();
      const merged = mergeSettings(DEFAULT_SETTINGS, {
        ...(local || {}),
        ...(dbVal || {}),
      });

      setSettings(merged);
      safeWriteLS(merged);

      // voliteľné: dorovnať DB ak tam chýbali kľúče
      await persistToDbIfAuthed(merged);
    } catch (e) {
      console.warn("[Settings] attachUser hydrate failed", e);
      // nič – ostávame na LS
    } finally {
      hydratingRef.current = false;
    }
  };

  const detachUser = () => {
    userIdRef.current = null;
  };

  const value = useMemo<SettingsCtx>(
    () => ({
      settings,
      lang: settings.language,
      setLang,
      updateSettings,
      attachUser,
      detachUser,
    }),
    [settings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within <SettingsProvider>");
  return ctx;
}