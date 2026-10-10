// src/app/shared/widgets/useWidgetLayout.ts
"use client";

import { useCallback, useMemo } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useCoachDataOptional } from "@/app/shared/components/dataProviders/CoachDataProvider";
import { saveWidgetPrefs, saveWidgetPrefsDebounced, useWidgetPrefs } from "@/app/shared/state/widgetPrefsStore";
import {
  WIDGETS,
  WIDGET_BY_ID,
  homeOrder,
  newWidgetView,
  ownWidgetView,
  widgetOn,
  type WidgetFacts,
  type WidgetId,
  type WidgetPrefs,
  type WidgetSection,
  type WidgetView,
} from "@/app/shared/widgets/widgetCatalog";

function factsFromCoachPrefs(prefs: any): WidgetFacts {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const races: any[] = prefs?.targets?.run?.races ?? [];
  return {
    strengthOptedOut: prefs?.strength_settings?.sessions_per_week === 0,
    hasUpcomingRace: races.some((r) => r?.date && new Date(r.date) >= today),
    advisorMode: prefs?.coach_mode === "advisor",
  };
}

const NO_FACTS: WidgetFacts = { strengthOptedOut: false, hasUpcomingRace: false, advisorMode: false };

/**
 * Čo sa má ukázať: voľba usera + automatické pravidlá + stav plánu.
 *
 * Počas prezerania zverenca (Živý tréner) platí trénerov výber pre tohto
 * zverenca (prefs trénera, `athletes[id]`), predvolene všetko. Výber
 * zverenca sa nepoužíva – je pre jeho tréning a tréner môže chcieť vidieť
 * viac (napr. recovery, ktoré si zverenec skryl).
 */
export function useWidgetLayout() {
  const { ownUserId, trainerView } = useUserId();
  const { prefs: own, ready, needsSetup } = useWidgetPrefs(ownUserId);
  const coach = useCoachDataOptional();

  const coachPrefs = coach?.prefsLoaded ? coach.prefs : null;
  const facts = useMemo(() => (coachPrefs ? factsFromCoachPrefs(coachPrefs) : NO_FACTS), [coachPrefs]);

  const athleteKey = trainerView ? String(trainerView.athleteId) : null;
  // uložený výber pre aktuálny pohľad (vlastný / pre zverenca); null = ešte nie je
  const stored: WidgetView | null = athleteKey ? own?.athletes?.[athleteKey] ?? null : ownWidgetView(own);

  // kým sa voľba nenačíta, platí celá appka (ako doteraz)
  const prefs: WidgetView = useMemo(() => stored ?? newWidgetView("all"), [stored]);

  /** Uloží výber aktuálneho pohľadu – zvyšok prefs (vlastné / ostatní zverenci) ostáva. */
  const saveView = useCallback(
    (view: WidgetView, opts?: { debounced?: boolean; onError?: () => void }) => {
      if (!ownUserId) return;
      // bez uložených prefs vlastné zameranie nevzniká – pri pohľade na
      // zverenca si ho tréner vyberie až sám pre seba
      const base: WidgetPrefs = own ?? { v: 1, overrides: {}, home: null };
      const next: WidgetPrefs = athleteKey
        ? { ...base, athletes: { ...base.athletes, [athleteKey]: view } }
        : { ...base, ...view };
      if (opts?.debounced) saveWidgetPrefsDebounced(ownUserId, next, opts.onError);
      else saveWidgetPrefs(ownUserId, next).catch(() => opts?.onError?.());
    },
    [ownUserId, own, athleteKey],
  );

  const isOn = useCallback((id: WidgetId) => widgetOn(prefs, id, facts), [prefs, facts]);

  // stav plánu – widgety, ktoré bez plánu nemajú čo ukázať
  const activePlan = coach?.activePlanStatus;
  const hasActivePlan = activePlan?.loaded ? !!activePlan.data?.has_active : null;
  const isAdvisorMode = (coach?.prefs as any)?.coach_mode === "advisor";

  const isAvailable = useCallback(
    (id: WidgetId) => {
      const needs = WIDGET_BY_ID[id].needs ?? [];
      if (needs.includes("active_plan") && !hasActivePlan) return false;
      if (needs.includes("coach_mode") && isAdvisorMode) return false;
      if (needs.includes("advisor_ready") && !isAdvisorMode && hasActivePlan !== false) return false;
      return true;
    },
    [hasActivePlan, isAdvisorMode],
  );

  const home = useMemo(() => homeOrder(prefs).filter(isOn), [prefs, isOn]);

  const sectionVisible = useCallback(
    (section: WidgetSection) => WIDGETS.some((w) => w.section === section && isOn(w.id)),
    [isOn],
  );

  return {
    prefs,
    /** uložená voľba aktuálneho pohľadu (null = ešte nevybral) */
    stored,
    saveView,
    facts,
    ready: !!trainerView || ready,
    needsSetup: !trainerView && needsSetup,
    /** výber sa ukladá do prefs prihláseného usera (aj trénerov pre zverenca) */
    editable: !!ownUserId,
    ownUserId,
    isOn,
    isAvailable,
    hasActivePlan,
    ensurePlanStatus: activePlan?.ensure,
    home,
    sectionVisible,
  };
}
