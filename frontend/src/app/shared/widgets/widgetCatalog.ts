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

/** Profil z úvodného nastavenia. "all" = celá appka ako doteraz. */
export type WidgetProfile = "strength" | "endurance" | "health" | "all";

export const WIDGET_PROFILES: WidgetProfile[] = ["strength", "endurance", "health", "all"];

export type WidgetId =
  // aktivity
  | "calendar"
  | "today"
  | "strength_log"
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

const ALL: WidgetProfile[] = ["strength", "endurance", "health", "all"];

// Poradie = poradie v nastaveniach aj v sekcii (okrem trénera, ten má
// vlastné poradie podľa toho, či beží plán). Kalendár je v Aktivitách
// posledný – hlavné miesto má na Domove.
export const WIDGETS: WidgetDef[] = [
  // ─── Aktivity ───
  { id: "today", section: "activities", titleKey: "todayActivities.title", profiles: ["endurance", "health", "all"] },
  { id: "strength_log", section: "activities", titleKey: "strengthLog.widget.title", profiles: ALL },
  { id: "wrapped", section: "activities", titleKey: "activitiesWrapped.widget.title", profiles: ["endurance", "all"] },
  { id: "streak", section: "activities", titleKey: "streak.widget.title", profiles: ALL },
  { id: "monthly_summary", section: "activities", titleKey: "monthlySummary.widget.title", profiles: ["endurance", "health", "all"] },
  { id: "weekly_load", section: "activities", titleKey: "weeklyLoad.widget.title", profiles: ["endurance", "all"] },
  { id: "mono_strain", section: "activities", titleKey: "monoStrain.widget.title", profiles: ["all"] },
  { id: "pareto", section: "activities", titleKey: "pareto8020.title", profiles: ["all"] },
  { id: "routes", section: "activities", titleKey: "sessions.routeMatch.widgetTitle", profiles: ["endurance", "all"] },
  { id: "calendar", section: "activities", titleKey: "calendar.widget.title", profiles: ALL },

  // ─── Tréner ───
  { id: "coach_prefs", section: "coach", titleKey: "coachPrefs.widget.title", profiles: ["endurance", "health", "all"] },
  { id: "daily_plan", section: "coach", titleKey: "coachDaily.widget.title", profiles: ALL, needs: ["active_plan"] },
  // tréningy si skladá sám, AI hodnotí a radí (advisor) – hlavne pre posilňovňu
  { id: "advisor", section: "coach", titleKey: "advisorWidget.title", profiles: ["strength", "all"], needs: ["advisor_ready"] },
  { id: "weekly_plan", section: "coach", titleKey: "coachWeekly.widget.title", profiles: ["endurance", "all"], needs: ["active_plan", "coach_mode"] },
  { id: "athlete_state", section: "coach", titleKey: "coachAthleteState.widget.title", profiles: ["endurance", "health", "all"] },
  { id: "plan_summary", section: "coach", titleKey: "coachPlanSummary.widget.title", profiles: ["endurance", "health", "all"] },
  { id: "progress", section: "coach", titleKey: "coachProgress.widget.title", profiles: ["endurance", "all"] },
  { id: "race", section: "coach", titleKey: "upcomingRace.widget.title", profiles: ["endurance", "all"] },
  { id: "notes", section: "coach", titleKey: "coachNotes.widget.title", profiles: ["all"], needs: ["active_plan"] },
  { id: "health", section: "coach", titleKey: "healthLog.widget.title", profiles: ["all"], needs: ["active_plan"] },
  { id: "external_events", section: "coach", titleKey: "externalEvents.widget.title", profiles: ["all"] },
  { id: "compliance", section: "coach", titleKey: "coachCompliance.widget.title", profiles: ["all"], needs: ["active_plan"] },

  // ─── Výkon ───
  { id: "est_paces", section: "performance", titleKey: "estTopPaces.widget.title", profiles: ["endurance", "all"] },
  { id: "pb", section: "performance", titleKey: "PB.widget.title", profiles: ["endurance", "all"] },
  { id: "zones_hr", section: "performance", titleKey: "zonesHR.widget.title", profiles: ["all"] },
  { id: "zones_paces", section: "performance", titleKey: "zonesPaces.widget.title", profiles: ["all"] },
  { id: "vo2max", section: "performance", titleKey: "VO2Max.widget.title", profiles: ["endurance", "all"] },
  { id: "body_weight", section: "performance", titleKey: "performance.metrics.weightLabel", profiles: ["strength", "health", "all"] },
  { id: "body_fat", section: "performance", titleKey: "bodyFat.widget.title", profiles: ["strength", "health", "all"] },
  { id: "body_scan", section: "performance", titleKey: "bodyScan.widget.title", profiles: ["strength", "all"] },

  // ─── Recovery ───
  { id: "readiness", section: "recovery", titleKey: "readiness.widget.title", profiles: ["endurance", "all"] },
  { id: "rhr", section: "recovery", titleKey: "RHR.widget.title", profiles: ["endurance", "all"] },
  { id: "hrv", section: "recovery", titleKey: "HRV.widget.title", profiles: ["endurance", "all"] },
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
  // kalendár zatiaľ neukazuje ručne zapísané silové tréningy – denník ide prvý
  strength: ["strength_log", "advisor", "calendar", "streak", "body_weight"],
  endurance: ["calendar", "daily_plan", "today", "race", "readiness"],
  health: ["calendar", "daily_plan", "today", "body_weight"],
  all: ["calendar", "daily_plan", "today", "race", "readiness"],
};

/* ─── Uložená voľba usera (users_preferences, kľúč "ui.widgets") ─── */

export const WIDGET_PREFS_KEY = "ui.widgets";

export type WidgetPrefs = {
  v: 1;
  profile: WidgetProfile;
  /** výslovná voľba usera – má prednosť pred profilom aj auto pravidlami */
  overrides: Partial<Record<WidgetId, boolean>>;
  /** poradie widgetov na Domove; null = predvolené podľa profilu */
  home: WidgetId[] | null;
};

export function newWidgetPrefs(profile: WidgetProfile): WidgetPrefs {
  return { v: 1, profile, overrides: {}, home: null };
}

/** Bezpečné načítanie z DB/localStorage – neznáme id a hodnoty zahodí. */
export function parseWidgetPrefs(raw: unknown): WidgetPrefs | null {
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

  return { v: 1, profile: r.profile, overrides, home };
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
  if (id === "strength_log" && facts.strengthOptedOut && profile !== "strength") return false;
  return WIDGET_BY_ID[id].profiles.includes(profile);
}

export function widgetOn(prefs: WidgetPrefs, id: WidgetId, facts: WidgetFacts): boolean {
  const o = prefs.overrides[id];
  return typeof o === "boolean" ? o : defaultWidgetOn(id, prefs.profile, facts);
}

/** Poradie Domova (aj s vypnutými – filtruje volajúci). */
export function homeOrder(prefs: WidgetPrefs): WidgetId[] {
  return prefs.home ?? DEFAULT_HOME[prefs.profile];
}
