// src/app/shared/widgets/CatalogWidget.tsx
"use client";

import { useRouter } from "next/navigation";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { useT } from "@/app/shared/i18n/useT";
import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";
import type { WidgetId } from "@/app/shared/widgets/widgetCatalog";

import WidgetActivitiesCalendar from "@/app/features/activities/widgets/WidgetActivitiesCalendar";
import WidgetTodayActivities from "@/app/features/activities/widgets/WidgetTodayActivities";
import WidgetStrengthLog from "@/app/features/activities/widgets/WidgetStrengthLog";
import WidgetActivitiesWrapped from "@/app/features/activities/widgets/WidgetActivitiesWrapped";
import WidgetStreak from "@/app/features/activities/widgets/WidgetStreak";
import WidgetMonthlySummary from "@/app/features/activities/widgets/WidgetMonthlySummary";
import WidgetWeeklyLoad from "@/app/features/activities/widgets/WidgetWeeklyLoad";
import WidgetMonoStrain from "@/app/features/activities/widgets/WidgetMonoStrain";
import WidgetPareto8020 from "@/app/features/activities/widgets/WidgetPareto8020";
import WidgetRouteMatch from "@/app/features/activities/widgets/WidgetRouteMatch";

import WidgetCoachPrefs from "@/app/features/coach/widgets/WidgetCoachPrefs";
import WidgetCoachDailyPlan from "@/app/features/coach/widgets/WidgetCoachDailyPlan";
import WidgetCoachWeeklyPlan from "@/app/features/coach/widgets/WidgetCoachWeeklyPlan";
import WidgetCoachAthleteState from "@/app/features/coach/widgets/WidgetCoachAthleteState";
import WidgetCoachPlanSummary from "@/app/features/coach/widgets/WidgetCoachPlanSummary";
import WidgetCoachProgress from "@/app/features/coach/widgets/WidgetCoachProgress";
import WidgetUpcomingRace from "@/app/features/coach/widgets/WidgetUpcomingRace";
import WidgetCoachNotes from "@/app/features/coach/widgets/WidgetCoachNotes";
import WidgetAthleteHealth from "@/app/features/coach/widgets/WidgetAthleteHealth";
import WidgetExternalEvents from "@/app/features/coach/widgets/WidgetExternalEvents";
import WidgetCoachPlanCompliance from "@/app/features/coach/widgets/WidgetCoachPlanCompliance";

import WidgetEstTopPaces from "@/app/features/performance/widgets/WidgetEstTopPaces";
import WidgetPB from "@/app/features/performance/widgets/WidgetPB";
import WidgetVO2Max from "@/app/features/performance/widgets/WidgetVO2Max";
import WidgetZonesHR from "@/app/features/performance/widgets/WidgetZonesHR";
import WidgetZonesPaces from "@/app/features/performance/widgets/WidgetZonesPaces";
import WidgetBodyWeight from "@/app/features/performance/widgets/WidgetBodyWeight";
import WidgetBodyFat from "@/app/features/performance/widgets/WidgetBodyFat";
import WidgetBodyScan from "@/app/features/performance/widgets/WidgetBodyScan";

import WidgetReadiness from "@/app/features/recovery/widgets/WidgetReadiness";
import WidgetRHR from "@/app/features/recovery/widgets/WidgetRHR";
import WidgetHRV from "@/app/features/recovery/widgets/WidgetHRV";
import WidgetSleepDuration from "@/app/features/recovery/widgets/WidgetSleepDuration";
import WidgetSleepStart from "@/app/features/recovery/widgets/WidgetSleepStart";

/**
 * Jeden widget z katalógu aj s cieľom prekliku – rovnaký na Domove aj
 * v sekcii, aby sa route nedefinovali na dvoch miestach.
 */
export default function CatalogWidget({ id }: { id: WidgetId }) {
  const router = useRouter();
  const t = useT();
  const { settings } = useSettings();
  const showAdvanced = settings?.show_advanced ?? false;
  const { prefs } = useCoachData();
  const isAdvisorMode = (prefs as any)?.coach_mode === "advisor";
  const go = (href: string) => () => router.push(href);

  switch (id) {
    /* ─── Aktivity ─── */
    case "calendar":
      return <WidgetActivitiesCalendar />;
    case "today":
      return (
        <WidgetTodayActivities onOpenDetail={(activityId) => router.push(`/activities/detail/${activityId}`)} />
      );
    case "strength_log":
      return (
        <WidgetStrengthLog
          onOpenDetail={go("/activities/strength")}
          onOpenSession={(sessionId) => router.push(`/activities/strength/${sessionId}`)}
        />
      );
    case "wrapped":
      return <WidgetActivitiesWrapped onOpenDetail={go("/activities/wrapped")} />;
    case "streak":
      return <WidgetStreak onOpenDetail={go("/activities/streak")} />;
    case "monthly_summary":
      return <WidgetMonthlySummary onOpenDetail={go("/activities/monthlySummary")} />;
    case "weekly_load":
      return <WidgetWeeklyLoad onOpenDetail={go("/activities/load")} />;
    case "mono_strain":
      return <WidgetMonoStrain onOpenDetail={go("/activities/mono")} />;
    case "pareto":
      return <WidgetPareto8020 onOpenTrend={go("/activities/pareto")} weeks={2} />;
    case "routes":
      return <WidgetRouteMatch onOpenDetail={go("/activities/routes")} />;

    /* ─── Tréner ─── */
    case "coach_prefs":
      return <WidgetCoachPrefs onOpenDetail={go("/coach/prefs")} />;
    case "daily_plan":
      // rovnaký widget v oboch režimoch – líši sa titulok a cieľ prekliku
      return (
        <WidgetCoachDailyPlan
          title={isAdvisorMode ? t("coachDaily.widget.titleAdvisor") : undefined}
          onOpenDetail={go(isAdvisorMode ? "/coach/advisor/daily" : "/coach/ai/dailyPlan")}
        />
      );
    case "weekly_plan":
      return <WidgetCoachWeeklyPlan onOpenDetail={go("/coach/ai/weeklyPlan")} />;
    case "athlete_state":
      return <WidgetCoachAthleteState onOpenDetail={go("/coach/ai/athleteState")} />;
    case "plan_summary":
      return <WidgetCoachPlanSummary onOpenDetail={go("/coach/ai/planSummary")} />;
    case "progress":
      return <WidgetCoachProgress onOpenDetail={go("/coach/ai/progress")} />;
    case "race":
      return <WidgetUpcomingRace onOpenDetail={go("/coach/race-countdown")} />;
    case "notes":
      return <WidgetCoachNotes onOpenDetail={go("/coach/notes")} />;
    case "health":
      return <WidgetAthleteHealth onOpenDetail={go("/coach/health")} />;
    case "external_events":
      return <WidgetExternalEvents />;
    case "compliance":
      return <WidgetCoachPlanCompliance onOpenDetail={go("/coach/compliance")} />;

    /* ─── Výkon ─── */
    case "est_paces":
      return <WidgetEstTopPaces onOpenDetail={go("/performance/estTopPaces")} />;
    case "pb":
      return <WidgetPB onOpenDetail={go("/performance/pb")} />;
    case "vo2max":
      return <WidgetVO2Max showAdvanced={showAdvanced} onOpenDetail={go("/performance/vo2max")} />;
    case "zones_hr":
      return <WidgetZonesHR onOpenDetail={go("/performance/zonesHR")} />;
    case "zones_paces":
      return <WidgetZonesPaces onOpenDetail={go("/performance/zonesPaces")} />;
    case "body_weight":
      return <WidgetBodyWeight showAdvanced={showAdvanced} onOpenDetail={go("/performance/bodyweight")} />;
    case "body_fat":
      return <WidgetBodyFat onOpenDetail={go("/performance/bodyfat")} />;
    case "body_scan":
      return <WidgetBodyScan onOpenDetail={go("/performance/bodyScan")} />;

    /* ─── Recovery ─── */
    case "readiness":
      return <WidgetReadiness onOpenDetail={go("/recovery/readiness")} />;
    case "rhr":
      return <WidgetRHR onOpenDetail={go("/recovery/rhr")} />;
    case "hrv":
      return <WidgetHRV onOpenDetail={go("/recovery/hrv")} />;
    case "sleep_duration":
      return <WidgetSleepDuration onOpenDetail={go("/recovery/sleepDuration")} />;
    case "sleep_start":
      return <WidgetSleepStart onOpenDetail={go("/recovery/sleepStart")} />;

    default:
      return null;
  }
}
