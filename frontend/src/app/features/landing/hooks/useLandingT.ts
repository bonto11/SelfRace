"use client";

import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { useT } from "@/app/shared/i18n/useT";
import type { UiLang } from "@/app/shared/i18n/locale";

export type LandingT = ReturnType<typeof useT>;

/*
 * Kým SettingsProvider nenačíta jazyk (localStorage / prehliadač), platí jazyk
 * zo servera (Accept-Language). Server tak vykreslí landing hneď v jazyku
 * návštevníka a prvé vykreslenie na klientovi sedí so SSR – bez prebliknutia z EN.
 */
export function useLandingT(initialLang: UiLang): LandingT {
  const { ready } = useSettings();
  return useT(ready ? null : initialLang);
}
