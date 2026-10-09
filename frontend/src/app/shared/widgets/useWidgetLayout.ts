// src/app/shared/widgets/useWidgetLayout.ts
"use client";

import { useCallback, useMemo } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useCoachDataOptional } from "@/app/shared/components/dataProviders/CoachDataProvider";
import { useWidgetPrefs } from "@/app/shared/state/widgetPrefsStore";
import {
  WIDGETS,
  WIDGET_BY_ID,
  homeOrder,
  newWidgetPrefs,
  widgetOn,
  type WidgetFacts,
  type WidgetId,
  type WidgetPrefs,
  type WidgetSection,
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
 * Počas prezerania zverenca (Živý tréner) tréner vidí všetko – jeho vlastný
 * výber je pre jeho tréning, nie pre cudzie dáta.
 */
export function useWidgetLayout() {
  const { ownUserId, trainerView } = useUserId();
  const { prefs: stored, ready, needsSetup } = useWidgetPrefs(ownUserId);
  const coach = useCoachDataOptional();

  const coachPrefs = coach?.prefsLoaded ? coach.prefs : null;
  const facts = useMemo(() => (coachPrefs ? factsFromCoachPrefs(coachPrefs) : NO_FACTS), [coachPrefs]);

  // kým sa voľba nenačíta, platí celá appka (ako doteraz)
  const prefs: WidgetPrefs = useMemo(
    () => (trainerView || !stored ? newWidgetPrefs("all") : stored),
    [trainerView, stored],
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
    /** uložená voľba (null = ešte nevybral) */
    stored,
    facts,
    ready: !!trainerView || ready,
    needsSetup: !trainerView && needsSetup,
    /** voľbu môže meniť len vlastný účet, nie počas prezerania zverenca */
    editable: !trainerView && !!ownUserId,
    ownUserId,
    isOn,
    isAvailable,
    hasActivePlan,
    ensurePlanStatus: activePlan?.ensure,
    home,
    sectionVisible,
  };
}
