// src/app/features/prefs/utils/sectionProgress.ts
// Postup v nastaveniach trénera - ktoré sekcie sú hotové a ktorá bola
// otvorená naposledy, aby user po návrate videl, kde skončil.

export type PrefsSectionKey =
  | "planStart"
  | "goal"
  | "sports"
  | "volume"
  | "strength"
  | "days"
  | "rules"
  | "zones"
  | "thresholds"
  | "focusAvoid"
  | "rehab";

type StoredProgress = {
  confirmed: PrefsSectionKey[];
  last: PrefsSectionKey | null;
};

const storageKey = (userId: number | string) =>
  `selfrace.prefs.sections.v2.${userId}`;

// PREČO localStorage a nie coach.prefs v DB: prefs idú do AI kontextu,
// stav UI by tam bol len šum. Ide o pohodlie jedného zariadenia - keď sa
// stratí, fajky sa aj tak dopočítajú z dát (sectionHasData).
export function readSectionProgress(
  userId: number | string | null | undefined,
): StoredProgress {
  const empty: StoredProgress = { confirmed: [], last: null };
  if (!userId) return empty;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    return {
      confirmed: Array.isArray(parsed?.confirmed) ? parsed.confirmed : [],
      last: typeof parsed?.last === "string" ? parsed.last : null,
    };
  } catch {
    return empty;
  }
}

export function writeSectionProgress(
  userId: number | string | null | undefined,
  progress: StoredProgress,
): void {
  if (!userId) return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(progress));
  } catch {
    // súkromné okno / plné úložisko - postup sa len nezapamätá
  }
}

const hasItems = (v: unknown) => Array.isArray(v) && v.length > 0;

/** Sekcia má vyplnené dáta - platí aj pre usera, ktorý nastavoval ešte v starom UI. */
export function sectionHasData(key: PrefsSectionKey, local: any): boolean {
  const p = local?.preferences ?? {};
  switch (key) {
    case "planStart":
      return !!local?.start_date && (!!local?.end_date || Number(local?.weeks) > 0);
    case "goal":
      return !!local?.goal_kind;
    case "sports":
      return !!local?.main_sport;
    case "volume":
      return Number(local?.volume?.value) > 0;
    case "strength": {
      const s = local?.strength_settings ?? {};
      return s.sessions_per_week != null || !!s.location;
    }
    case "days":
      return hasItems(p.days_off) || hasItems(p.long_run_days);
    case "zones":
      return local?.zones?.z1_max != null;
    case "thresholds":
      return hasItems(local?.thresholds_latest);
    case "focusAvoid":
      return hasItems(local?.focus_areas) || hasItems(local?.avoid_zones);
    case "rehab": {
      const r = local?.rehab_focus ?? {};
      return !!(r.stretching || r.mobility || r.balance);
    }
    // pravidlá majú vždy rozumné predvolené hodnoty - hotové sú až po potvrdení
    case "rules":
      return false;
  }
}

// Sekcie, ktoré fungujú aj bez zásahu usera - majú predvolené hodnoty
// (pravidlá) alebo sú voliteľné. Bez dát ukazujú "Predvolené", nie "chýba".
const SECTIONS_WITH_DEFAULTS: PrefsSectionKey[] = [
  "rules",
  "zones",
  "thresholds",
  "focusAvoid",
  "rehab",
];

// Zóny a prahy sa ukladajú vlastným tlačidlom priamo do DB - reset by tu
// mazal len rozpracovaný stav formulára, preto ho nemajú.
export const RESETTABLE_SECTIONS: PrefsSectionKey[] = [
  "planStart",
  "goal",
  "sports",
  "volume",
  "strength",
  "days",
  "rules",
  "focusAvoid",
  "rehab",
];

export type SectionStatus = "done" | "default" | "todo";

/**
 * done = user sekciu vedome nastavil (dáta, zmena alebo "Hotovo").
 * Samotné otvorenie a zatvorenie sekciu NEoznačí - hodnoty rovnaké ako
 * predvolené sa rátajú až po potvrdení tlačidlom Hotovo.
 */
export function sectionStatus(
  key: PrefsSectionKey,
  local: any,
  confirmed: PrefsSectionKey[],
): SectionStatus {
  if (confirmed.includes(key) || sectionHasData(key, local)) return "done";
  return SECTIONS_WITH_DEFAULTS.includes(key) ? "default" : "todo";
}
