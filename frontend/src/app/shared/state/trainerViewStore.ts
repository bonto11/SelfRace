"use client";

import { appLang } from "@/app/shared/i18n/locale";
import { sk } from "@/app/shared/i18n/locales/sk";
import { cs } from "@/app/shared/i18n/locales/cs";
import { en } from "@/app/shared/i18n/locales/en";

/*
 * Živý tréner – režim prezerania zverenca.
 *
 * Kým je zapnutý, useUserId() vracia id zverenca, takže celá appka (data
 * providery, detaily, kalendár) ukazuje jeho dáta bez úprav jednotlivých
 * widgetov. Vlastné veci trénera (nastavenia, predplatné, jazyk, push)
 * berú ownUserId.
 *
 * PREČO sessionStorage: po zatvorení appky sa tréner vráti k sebe – cudzí
 * profil nesmie byť prekvapenie pri ďalšom otvorení.
 *
 * Bezpečnosť nestojí na FE: čítanie povoľuje RLS (sql/trainer_read_access.sql)
 * len pri aktívnom linku a zápis tréner nemá nikde. Blok zápisov
 * v callBackend je poistka, aby tréner omylom nespúšťal akcie (AI, ukladanie)
 * nad cudzím účtom.
 */

export type TrainerView = {
  athleteId: number;
  name: string;
  /** auth uuid trénera – iný prihlásený user na tom istom tabe režim nepreberie */
  ownerUuid: string;
};

const KEY = "sr:trainer-view";

function read(): TrainerView | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v || !Number(v.athleteId) || typeof v.ownerUuid !== "string") return null;
    return { athleteId: Number(v.athleteId), name: String(v.name ?? ""), ownerUuid: v.ownerUuid };
  } catch {
    return null;
  }
}

const current: TrainerView | null = read();

/**
 * Beží prezeranie (bez kontroly usera). Pre perzistentnú cache – dáta
 * zverenca sa na zariadení trénera neukladajú natrvalo.
 */
export function isTrainerViewSession(): boolean {
  return current !== null;
}

/** Režim prezerania platný pre prihláseného usera (uuid), inak null. */
export function getTrainerView(ownerUuid: string | null | undefined): TrainerView | null {
  if (!current || !ownerUuid || current.ownerUuid !== ownerUuid) return null;
  return current;
}

// PREČO tieto kľúče: coach prefs sa v localStorage držia bez userId
// (features/prefs/utils/prefs.ts) – po prezeraní by tam ostali prefs zverenca.
const SHARED_LS_KEYS = [
  "up:coach.prefs",
  "up:advisor.session_templates",
  "coach.prefs",
  "coach.generated",
];

function clearSharedLocalState() {
  try {
    SHARED_LS_KEYS.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

/*
 * Prepnutie ide cez úplný reload: providery, bootstrapy a stav v pamäti
 * (refs, initialized flagy) sa tak načítajú nanovo pre správneho usera,
 * bez hľadania všetkých miest, kde si niečo pamätajú.
 */
export function startTrainerView(view: TrainerView, redirectTo: string = "/coach") {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(view));
  } catch {
    return;
  }
  clearSharedLocalState();
  window.location.assign(redirectTo);
}

export function endTrainerView(redirectTo: string = "/settings") {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  clearSharedLocalState();
  window.location.assign(redirectTo);
}

/** Text pre zablokovaný zápis (mimo Reactu – volá ho callBackend). */
export function trainerViewReadOnlyText(): string {
  const lang = appLang();
  const dict = lang === "cs" ? cs : lang === "en" ? en : sk;
  return dict.trainer.view.readOnly;
}

/*
 * POST cesty, ktoré smú ísť aj počas prezerania: vlastné akcie trénera
 * a čítania, ktoré FE posiela ako POST (detail aktivity – streamy a extras
 * sa čítajú z DB, ukladanie novo stiahnutých trénerovi aj tak zablokuje RLS).
 */
const ALLOWED_WRITE_PREFIXES = [
  "/trainer/",
  "/users/resolve",
  "/analytics/activityStreams/",
  "/analytics/activityExtras/",
];

export function isAllowedDuringTrainerView(path: string): boolean {
  return ALLOWED_WRITE_PREFIXES.some((p) => path.startsWith(p));
}
