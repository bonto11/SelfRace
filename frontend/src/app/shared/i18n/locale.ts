// src/app/shared/i18n/locale.ts
// Jazyky, ktoré FE reálne prekladá, a ich Intl locale.
export type UiLang = "sk" | "en" | "cs";

export const UI_LANGS: readonly UiLang[] = ["sk", "en", "cs"];

export function normalizeLang(v: unknown): UiLang | null {
  return typeof v === "string" && (UI_LANGS as readonly string[]).includes(v) ? (v as UiLang) : null;
}

/** Jazyk prehliadača → podporovaný jazyk (default EN). */
export function guessUiLang(raw: string | undefined | null): UiLang {
  const s = (raw ?? "").toLowerCase();
  if (s.startsWith("sk")) return "sk";
  if (s.startsWith("cs") || s.startsWith("cz")) return "cs";
  return "en";
}

/** Intl locale pre dátumy a čísla. EN = en-GB (deň pred mesiacom, 24 h). */
export function localeTag(lang: unknown): string {
  const l = normalizeLang(lang);
  return l === "cs" ? "cs-CZ" : l === "en" ? "en-GB" : "sk-SK";
}

// Aktuálny jazyk aj mimo Reactu (formátovacie helpery v utils). Nastavuje ho SettingsProvider;
// komponenty sa pri zmene jazyka prekreslia cez useT/useSettings, takže hodnota je vždy čerstvá.
let currentLang: UiLang = "sk";

export function setCurrentLang(lang: unknown) {
  currentLang = normalizeLang(lang) ?? "en";
}

export function appLang(): UiLang {
  return currentLang;
}

export function appLocale(): string {
  return localeTag(currentLang);
}
