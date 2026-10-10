// src/app/shared/widgets/widgetCatalog.ts
/*
 * Katalóg widgetov – jeden zoznam pre Domov, sekcie, navigáciu aj nastavenia.
 *
 * PREČO: appka má ~35 widgetov a nový user (napr. niekto, kto si chce len
 * zapisovať posilňovňu) sa v nich strácal. User si pri prvom prihlásení
 * vyberie profil („Čo chceš robiť?“), ten určí predvolené widgety a v
 * Nastaveniach → Moje widgety si ich vie zapnúť/vypnúť jednotlivo.
 *
 * Výslovná voľba usera (overrides) má vždy prednosť pred predvoľbou profilu
 * aj pred automatickými pravidlami – widget, ktorý si zapol, mu appka sama
 * neschová.
 */

export type WidgetSection = "activities" | "coach" | "performance" | "recovery";

export const WIDGET_SECTIONS: WidgetSection[] = ["activities", "coach", "performance", "recovery"];

/**
 * Profil (zameranie) z úvodného nastavenia. "all" = celá appka ako doteraz.
 * endurance = len beh a trail, hybrid = beh + posilňovanie, ocr = prekážkové
 * preteky a Hyrox (beh, sila, úchop – AI ich hodnotí špecificky).
 */
export type WidgetProfile = "strength" | "endurance" | "hybrid" | "ocr" | "health" | "all";

/** Poradie = poradie v úvodnom výbere aj v nastaveniach. */
export const WIDGET_PROFILES: WidgetProfile[] = ["strength", "endurance", "hybrid", "ocr", "health", "all"];

export type WidgetId =
  // aktivity
  | "calendar"
  | "today"
  | "strength_log"
  | "exercise_progress"
  | "streak"
  | "monthly_summary"
  | "weekly_load"
  | "mono_strain"
  | "pareto"
  | "routes"
  | "wrapped"
  // tréner
  | "coach_prefs"
  | "daily_plan"
  | "advisor"
  | "weekly_plan"
  | "athlete_state"
  | "plan_summary"
  | "progress"
  | "race"
  | "notes"
  | "health"
  | "external_events"
  | "compliance"
  // výkon
  | "est_paces"
  | "pb"
  | "vo2max"
  | "zones_hr"
  | "zones_paces"
  | "body_weight"
  | "body_fat"
  | "body_scan"
  // recovery
  | "readiness"
  | "rhr"
  | "hrv"
  | "sleep_duration"
  | "sleep_start";

/**
 * Kedy sa widget dá ukázať – nezávisle od voľby usera.
 * advisor_ready = advisor režim, alebo zatiaľ žiadny bežiaci plán (dá sa zapnúť);
 * pri bežiacom pláne od AI trénera AI poradca nemá zmysel.
 */
export type WidgetNeeds = "active_plan" | "coach_mode" | "advisor_ready";

export type WidgetDef = {
  id: WidgetId;
  section: WidgetSection;
  /** existujúci i18n kľúč titulku widgetu */
  titleKey: string;
  /** profily, v ktorých je widget predvolene zapnutý */
  profiles: WidgetProfile[];
  needs?: WidgetNeeds[];
};

const ALL: WidgetProfile[] = [...WIDGET_PROFILES];
/** bežecké zamerania – beh je hlavná vec */
const RUN: WidgetProfile[] = ["endurance", "hybrid", "ocr"];
/** zamerania so silovým tréningom */
const LIFT: WidgetProfile[] = ["strength", "hybrid", "ocr"];

// Poradie = poradie v nastaveniach aj v sekcii (okrem trénera, ten má
// vlastné poradie podľa toho, či beží plán). Kalendár je v Aktivitách
// posledný – hlavné miesto má na Domove.
export const WIDGETS: WidgetDef[] = [
  // ─── Aktivity ───
  { id: "today", section: "activities", titleKey: "todayActivities.title", profiles: [...RUN, "health", "all"] },
  { id: "strength_log", section: "activities", titleKey: "strengthLog.widget.title", profiles: [...LIFT, "health", "all"] },
  { id: "exercise_progress", section: "activities", titleKey: "exerciseProgress.title", profiles: [...LIFT, "all"] },
  { id: "wrapped", section: "activities", titleKey: "activitiesWrapped.widget.title", profiles: [...RUN, "all"] },
  { id: "streak", section: "activities", titleKey: "streak.widget.title", profiles: ALL },
  { id: "monthly_summary", section: "activities", titleKey: "monthlySummary.widget.title", profiles: ALL },
  { id: "weekly_load", section: "activities", titleKey: "weeklyLoad.widget.title", profiles: [...RUN, "all"] },
  { id: "mono_strain", section: "activities", titleKey: "monoStrain.widget.title", profiles: ["all"] },
  { id: "pareto", section: "activities", titleKey: "pareto8020.title", profiles: ["all"] },
  { id: "routes", section: "activities", titleKey: "sessions.routeMatch.widgetTitle", profiles: [...RUN, "all"] },
  { id: "calendar", section: "activities", titleKey: "calendar.widget.title", profiles: ALL },

  // ─── Tréner ───
  { id: "coach_prefs", section: "coach", titleKey: "coachPrefs.widget.title", profiles: [...RUN, "health", "all"] },
  { id: "daily_plan", section: "coach", titleKey: "coachDaily.widget.title", profiles: ALL, needs: ["active_plan"] },
  // tréningy si skladá sám, AI hodnotí a radí (advisor) – hlavne pre posilňovňu
  { id: "advisor", section: "coach", titleKey: "advisorWidget.title", profiles: ["strength", "all"], needs: ["advisor_ready"] },
  { id: "weekly_plan", section: "coach", titleKey: "coachWeekly.widget.title", profiles: [...RUN, "all"], needs: ["active_plan", "coach_mode"] },
  { id: "athlete_state", section: "coach", titleKey: "coachAthleteState.widget.title", profiles: [...RUN, "health", "all"] },
  { id: "plan_summary", section: "coach", titleKey: "coachPlanSummary.widget.title", profiles: [...RUN, "health", "all"] },
  { id: "progress", section: "coach", titleKey: "coachProgress.widget.title", profiles: [...RUN, "all"] },
  { id: "race", section: "coach", titleKey: "upcomingRace.widget.title", profiles: [...RUN, "all"] },
  { id: "notes", section: "coach", titleKey: "coachNotes.widget.title", profiles: ["all"], needs: ["active_plan"] },
  { id: "health", section: "coach", titleKey: "healthLog.widget.title", profiles: ["all"], needs: ["active_plan"] },
  { id: "external_events", section: "coach", titleKey: "externalEvents.widget.title", profiles: ["all"] },
  { id: "compliance", section: "coach", titleKey: "coachCompliance.widget.title", profiles: ["all"], needs: ["active_plan"] },

  // ─── Výkon ───
  { id: "est_paces", section: "performance", titleKey: "estTopPaces.widget.title", profiles: [...RUN, "all"] },
  { id: "pb", section: "performance", titleKey: "PB.widget.title", profiles: [...RUN, "all"] },
  { id: "zones_hr", section: "performance", titleKey: "zonesHR.widget.title", profiles: ["all"] },
  { id: "zones_paces", section: "performance", titleKey: "zonesPaces.widget.title", profiles: ["all"] },
  { id: "vo2max", section: "performance", titleKey: "VO2Max.widget.title", profiles: [...RUN, "all"] },
  { id: "body_weight", section: "performance", titleKey: "performance.metrics.weightLabel", profiles: [...LIFT, "health", "all"] },
  { id: "body_fat", section: "performance", titleKey: "bodyFat.widget.title", profiles: ["strength", "health", "all"] },
  { id: "body_scan", section: "performance", titleKey: "bodyScan.widget.title", profiles: ["strength", "all"] },

  // ─── Recovery ───
  { id: "readiness", section: "recovery", titleKey: "readiness.widget.title", profiles: [...RUN, "all"] },
  { id: "rhr", section: "recovery", titleKey: "RHR.widget.title", profiles: [...RUN, "all"] },
  { id: "hrv", section: "recovery", titleKey: "HRV.widget.title", profiles: [...RUN, "all"] },
  { id: "sleep_duration", section: "recovery", titleKey: "sleepDuration.widget.title", profiles: ["health", "all"] },
  { id: "sleep_start", section: "recovery", titleKey: "sleepStart.widget.title", profiles: ["all"] },
];

export const WIDGET_BY_ID: Record<WidgetId, WidgetDef> = Object.fromEntries(
  WIDGETS.map((w) => [w.id, w]),
) as Record<WidgetId, WidgetDef>;

export function isWidgetId(v: unknown): v is WidgetId {
  return typeof v === "string" && v in WIDGET_BY_ID;
}

/** Predvolený Domov podľa profilu – kalendár hore, pri posilňovni denník. */
export const DEFAULT_HOME: Record<WidgetProfile, WidgetId[]> = {
  // denník je pri sile hlavná vec – ide prvý
  strength: ["strength_log", "exercise_progress", "advisor", "calendar", "streak", "body_weight"],
  endurance: ["calendar", "daily_plan", "today", "race", "readiness"],
  hybrid: ["calendar", "daily_plan", "today", "strength_log", "race", "readiness"],
  ocr: ["calendar", "daily_plan", "today", "strength_log", "race", "readiness"],
  health: ["calendar", "daily_plan", "today", "body_weight"],
  all: ["calendar", "daily_plan", "today", "race", "readiness"],
};

/* ─── Uložená voľba usera (users_preferences, kľúč "ui.widgets") ─── */

export const WIDGET_PREFS_KEY = "ui.widgets";

/** Jeden výber widgetov – vlastný, alebo trénerov pre zverenca. */
export type WidgetView = {
  profile: WidgetProfile;
  /** výslovná voľba usera – má prednosť pred profilom aj auto pravidlami */
  overrides: Partial<Record<WidgetId, boolean>>;
  /** poradie widgetov na Domove; null = predvolené podľa profilu */
  home: WidgetId[] | null;
};

export type WidgetPrefs = Omit<WidgetView, "profile"> & {
  v: 1;
  /**
   * Vlastné zameranie. Chýba = user si ho ešte nevybral – napr. tréner
   * zatiaľ nastavil len pohľad na zverenca (úvodný výber sa mu ešte ukáže).
   */
  profile?: WidgetProfile;
  /**
   * Živý tréner: čo chce vidieť pri jednotlivých zverencoch (kľúč = users.id).
   * PREČO u trénera a nie u zverenca: výber zverenca je pre jeho vlastný
   * tréning a tréner do jeho prefs zápis nemá.
   */
  athletes?: Record<string, WidgetView>;
};

export function newWidgetView(profile: WidgetProfile): WidgetView {
  return { profile, overrides: {}, home: null };
}

export function newWidgetPrefs(profile: WidgetProfile): WidgetPrefs {
  return { v: 1, ...newWidgetView(profile) };
}

/** Vlastný výber z uložených prefs; null = zameranie ešte nevybral. */
export function ownWidgetView(prefs: WidgetPrefs | null): WidgetView | null {
  if (!prefs?.profile) return null;
  return { profile: prefs.profile, overrides: prefs.overrides, home: prefs.home };
}

function parseWidgetView(raw: unknown): WidgetView | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as any;
  if (!WIDGET_PROFILES.includes(r.profile)) return null;

  const overrides: Partial<Record<WidgetId, boolean>> = {};
  if (r.overrides && typeof r.overrides === "object") {
    for (const [k, v] of Object.entries(r.overrides)) {
      if (isWidgetId(k) && typeof v === "boolean") overrides[k] = v;
    }
  }
  const home = Array.isArray(r.home)
    ? Array.from(new Set((r.home as unknown[]).filter(isWidgetId)))
    : null;

  return { profile: r.profile, overrides, home };
}

/** Bezpečné načítanie z DB/localStorage – neznáme id a hodnoty zahodí. */
export function parseWidgetPrefs(raw: unknown): WidgetPrefs | null {
  if (!raw || typeof raw !== "object") return null;
  const own = parseWidgetView(raw);

  const athletes: Record<string, WidgetView> = {};
  const rawAthletes = (raw as any).athletes;
  if (rawAthletes && typeof rawAthletes === "object") {
    for (const [k, v] of Object.entries(rawAthletes)) {
      const view = /^\d+$/.test(k) ? parseWidgetView(v) : null;
      if (view) athletes[k] = view;
    }
  }
  const hasAthletes = Object.keys(athletes).length > 0;
  if (!own) return hasAthletes ? { v: 1, overrides: {}, home: null, athletes } : null;
  return hasAthletes ? { v: 1, ...own, athletes } : { v: 1, ...own };
}

/* ─── Výpočet, čo sa ukáže ─── */

/** Fakty o userovi pre automatické predvoľby (z coach prefs). */
export type WidgetFacts = {
  /** sessions_per_week = 0 – výslovne nechce posilňovať */
  strengthOptedOut: boolean;
  /** má zadaný budúci pretek */
  hasUpcomingRace: boolean;
  /** advisor režim – tréningy si skladá sám */
  advisorMode: boolean;
};

/** Predvoľba bez zásahu usera: profil + automatické pravidlá. */
export function defaultWidgetOn(id: WidgetId, profile: WidgetProfile, facts: WidgetFacts): boolean {
  // Pretek zadaný v trénerovi = chce ho vidieť, aj keď profil preteky nemá.
  if (id === "race" && facts.hasUpcomingRace) return true;
  // Kto si už plán skladá sám, chce vidieť aj hodnotenie od AI poradcu.
  if (id === "advisor" && facts.advisorMode) return true;
  // Silový denník: 0 tréningov týždenne je výslovná voľba – okrem profilu
  // „posilňovanie“, kde je denník hlavná vec.
  if ((id === "strength_log" || id === "exercise_progress") && facts.strengthOptedOut && profile !== "strength")
    return false;
  return WIDGET_BY_ID[id].profiles.includes(profile);
}

export function widgetOn(prefs: WidgetView, id: WidgetId, facts: WidgetFacts): boolean {
  const o = prefs.overrides[id];
  return typeof o === "boolean" ? o : defaultWidgetOn(id, prefs.profile, facts);
}

/** Poradie Domova (aj s vypnutými – filtruje volajúci). */
export function homeOrder(prefs: WidgetView): WidgetId[] {
  return prefs.home ?? DEFAULT_HOME[prefs.profile];
}
