// src/app/shared/ui/utils/sportMeta.ts
// 🌟 Jeden zdroj pravdy pre ikonku/farbu/label podľa sport_type_fe.
// Predtým mal DetailActivitiesWrapped.tsx aj (budúci) DetailPlanSummary.tsx
// každý svoj vlastný lokálny SPORT_LABEL/SPORT_ICON dictionary - duplicita,
// ktorá sa dala ľahko rozísť (napr. zmena prekladu na jednom mieste sa
// neprejavila v druhom). Farby teraz idú výhradne cez appColors.chartXxx
// tokeny (žiadne raw hex/rgb v komponentoch) - pozri app_colors.ts /
// paletteNatur.ts pre samotné hodnoty.

import { appColors } from "@/app/shared/ui/theme/app_colors";

export const SPORT_ICON: Record<string, string> = {
  run: "🏃",
  ride: "🚴",
  bike: "🚴",
  strength: "🏋️",
  mixed: "🔀",
  skate: "⛸️",
  football: "⚽",
  soccer: "⚽",
  padel: "🎾",
  pickleball: "🏓",
  badminton: "🏸",
  swim: "🏊",
  walk: "🚶",
  hike: "🥾",
  hiit: "🔥",
  yoga: "🧘",
  pilates: "🤸",
  surfing: "🏄",
  rock_climbing: "🧗",
  alpine_ski: "⛷️",
  other: "⚡",
};

// 🌟 Mapovanie na appColors.chartXxx tokeny (pozri Services/sport_type.py
// pre presné kanonické hodnoty, ktoré backend produkuje).
export const SPORT_COLOR: Record<string, string> = {
  run: appColors.chartRun,
  ride: appColors.chartBike,
  bike: appColors.chartBike,
  strength: appColors.chartStrength,
  mixed: appColors.chartMixed,
  skate: appColors.chartSkate,
  football: appColors.chartSoccer,
  soccer: appColors.chartSoccer,
  padel: appColors.chartPadel,
  pickleball: appColors.chartPickleball,
  badminton: appColors.chartBadminton,
  swim: appColors.chartSwim,
  walk: appColors.chartWalk,
  hike: appColors.chartHike,
  hiit: appColors.chartHiit,
  yoga: appColors.chartYoga,
  pilates: appColors.chartPilates,
  surfing: appColors.chartSurfing,
  rock_climbing: appColors.chartRockClimbing,
  alpine_ski: appColors.chartAlpineSki,
  other: appColors.chartOther,
};

export const FALLBACK_SPORT_ICON = "⚡";
export const FALLBACK_SPORT_COLOR = appColors.textMuted;

// Fallback label pre akýkoľvek sport_type_fe, ktorý (zatiaľ) nie je v
// prekladovom katalógu "sports.*" - rozdelí podľa "_"/medzier a
// capitalizuje, aby sa nikdy nestratila informácia v spoločnom "Iné".
export function prettifySport(sport: string): string {
  return sport
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function getSportIcon(sport: string): string {
  return SPORT_ICON[sport] || FALLBACK_SPORT_ICON;
}

export function getSportColor(sport: string): string {
  return SPORT_COLOR[sport] || FALLBACK_SPORT_COLOR;
}

// t = useT() z volajúcej komponenty. Kľúče v katalógu: "sports.run",
// "sports.ride", "sports.strength" atď. (pozri i18n sk/en katalóg).
export function getSportLabel(t: (key: any) => string, sport: string): string {
  const key = `common.sports.${sport}`;
  const translated = t(key as any);
  if (translated && translated !== key) return translated;
  return prettifySport(sport);
}

// ============================================================
// DETEKCIA Z TEXTU (meno-heuristika)
// ============================================================
// 🌟 Použi tam, kde nemáme štruktúrované sport pole a musíme hádať z voľného
// textu (typicky externé kalendárové eventy bez sport_type). Rovnaká
// myšlienka ako _name_kw/_name_re v Services/sport_type.py na backende,
// rozšírená o všetky kategórie, čo teraz backend produkuje - aby FE
// detekcia nezaostávala za BE kategóriami (predtým detectSport v
// @/app/shared/utils/sports.ts poznal len run/ride/strength/other).

const _detectKeywords: { key: string; re: RegExp }[] = [
  { key: "run", re: /(beh|run|behal|bežal|jog)/i },
  { key: "ride", re: /(bike|ride|bicy|cykl|zwift|trainer)/i },
  { key: "strength", re: /(posil|gym|weights?|drepy|drep|bench|mrtvy|mŕtvy|deadlift|činka|činky|strength)/i },
  { key: "swim", re: /(swim|pláv|plav)/i },
  { key: "walk", re: /(walk|prechádz)/i },
  { key: "hike", re: /(hike|tur)/i },
  { key: "skate", re: /(korču|brusl|skate)/i },
  { key: "soccer", re: /(futbal|soccer|football)/i },
  { key: "hiit", re: /(hiit|interval)/i },
  { key: "padel", re: /(padel)/i },
  { key: "pickleball", re: /(pickleball)/i },
  { key: "badminton", re: /(badminton)/i },
  { key: "yoga", re: /(yoga|joga)/i },
  { key: "pilates", re: /(pilates)/i },
  { key: "surfing", re: /(surf)/i },
  { key: "rock_climbing", re: /(climb|lezeni|boulder)/i },
];

// Signatúra zámerne kompatibilná so starým detectSport(it: any) z
// @/app/shared/utils/sports.ts - drop-in náhrada, žiadna zmena volajúceho
// kódu okrem cesty importu.
export function detectSport(it: any): string {
  const raw = String(it?.activity ?? it?.title ?? it?.name ?? "").toLowerCase();
  if (!raw) return "other";
  for (const { key, re } of _detectKeywords) {
    if (re.test(raw)) return key;
  }
  return "other";
}