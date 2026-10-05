// src/app/(protected)/coach/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/app/shared/ui/components/PageShell";
import { PAGE_GRID_2 } from "@/app/shared/ui/tokens/pageTokens";

import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";

import WidgetUpcomingRace from "@/app/shared/components/widgets/WidgetUpcomingRace";
import WidgetCoachPrefs from "@/app/shared/components/widgets/WidgetCoachPrefs";
import WidgetExternalEvents from "@/app/shared/components/widgets/WidgetExternalEvents";
import WidgetAthleteHealth from "@/app/shared/components/widgets/WidgetAthleteHealth";
import WidgetCoachAIAnalyze from "@/app/shared/components/widgets/WidgetCoachAthleteState";
import WidgetCoachAIWeekly from "@/app/shared/components/widgets/WidgetCoachWeeklyPlan";
import WidgetCoachAIDaily from "@/app/shared/components/widgets/WidgetCoachDailyPlan";
import WidgetCoachAIProgress from "@/app/shared/components/widgets/WidgetCoachProgress";
import WidgetCoachPlanCompliance from "@/app/shared/components/widgets/WidgetCoachPlanCompliance";
import WidgetCoachNotes from "@/app/shared/components/widgets/WidgetCoachNotes";
import WidgetCoachPlanSummary from "@/app/shared/components/widgets/WidgetCoachPlanSummary";

import Button from "@/app/shared/ui/components/Button";
import IconRefresh from "@/app/shared/svg/Refresh";
import ShowAdvancedToggle from "@/app/shared/ui/components/ShowAdvancedToggle";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useT } from "@/app/shared/i18n/useT";

function RefreshIconBtn() {
  const t = useT();
  const { refresh: refreshActivities, loading: loadingActivities } = useActivityData();
  const { refresh: refreshCoach, loading: loadingCoach } = useCoachData();
  const isGlobalLoading = loadingActivities || loadingCoach;

  return (
    <Button
      circle
      size="sm"
      variant="ghost"
      aria-label={t("common.refreshTitle" as any)}
      title={t("common.refreshTitle" as any)}
      onClick={() => {
        refreshActivities(true);
        refreshCoach(true);
      }}
      disabled={isGlobalLoading}
    >
      <IconRefresh className={`h-4 w-4 ${isGlobalLoading ? "animate-spin" : ""}`} />
    </Button>
  );
}

export default function Page() {
  const router = useRouter();
  const t = useT();
  const { settings } = useSettings() as any;
  const showAdvanced = settings?.show_advanced ?? false;

  const { weekly, plan, prefs, activePlanStatus } = useCoachData();

  // 🌟 NOVÉ: coach_mode žije v tom istom coach.prefs blobe ako ostatné
  // prefs, takže netreba nový fetch - len čítanie z existujúceho providera.
  const isAdvisorMode = (prefs as any)?.coach_mode === "advisor";

  // Stav plánu drží coach provider (cache + zdieľaný request s onboardingom).
  // Pri zmene plánu sa overí znova - ensure() reálne načíta len keď prebehol
  // zápis na BE (generovanie, zrušenie plánu) alebo sú dáta staré.
  useEffect(() => {
    activePlanStatus.ensure();
  }, [activePlanStatus.ensure, weekly.plan, plan.rows]);
  const hasActivePlan: boolean | null = activePlanStatus.loaded
    ? !!activePlanStatus.data?.has_active
    : null;

  return (
    <PageShell
      title={t("coach.title")}
      showBack={false}
      showPoweredByStrava={false}
      rightSlot={<RefreshIconBtn />}
    >
      <div className="mb-4">
        <ShowAdvancedToggle />
      </div>

      {hasActivePlan === null ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner size="trend" />
        </div>
      ) : hasActivePlan ? (
        /* ─── AKTÍVNY PLÁN: čo je práve najviac potrebné hore ─── */
        <div className={PAGE_GRID_2}>
          <WidgetUpcomingRace onOpenDetail={() => router.push("/coach/race-countdown")} />

          {/* 🌟 Daily widget je rovnaký v oboch režimoch - líši sa len
              titulok a cieľová route (editovateľný vs. AI-generovaný detail). */}
          <WidgetCoachAIDaily
            title={isAdvisorMode ? t("coachDaily.widget.titleAdvisor") : undefined}
            onOpenDetail={() =>
              router.push(isAdvisorMode ? "/coach/advisor/daily" : "/coach/ai/dailyPlan")
            }
          />

          {/* 🌟 Weekly widget sa v advisor režime nezobrazuje vôbec -
              weekly plán sa v advisor režime negeneruje. */}
          {!isAdvisorMode && (
            <WidgetCoachAIWeekly onOpenDetail={() => router.push("/coach/ai/weeklyPlan")} />
          )}

          <WidgetCoachAIAnalyze onOpenDetail={() => router.push("/coach/ai/athleteState")} />
          <WidgetCoachPlanSummary onOpenDetail={() => router.push("/coach/ai/planSummary")} />

          {showAdvanced && (
            <>
              <WidgetCoachAIProgress onOpenDetail={() => router.push("/coach/ai/progress")} />
              <WidgetCoachNotes onOpenDetail={() => router.push("/coach/notes")} />
              <WidgetAthleteHealth onOpenDetail={() => router.push("/coach/health")} />
              <WidgetExternalEvents />
              {/* 🌟 Compliance zostáva v oboch režimoch - plán (aj ručný)
                  existuje, štatistiky done/missed/postponed sú validné. */}
              <WidgetCoachPlanCompliance onOpenDetail={() => router.push("/coach/compliance")} />
            </>
          )}
          <WidgetCoachPrefs onOpenDetail={() => router.push("/coach/prefs")} />
        </div>
      ) : (
        /* ─── BEZ AKTÍVNEHO PLÁNU: nastavenie a spustenie hore ─── */
        <div className={PAGE_GRID_2}>
          <WidgetCoachPrefs onOpenDetail={() => router.push("/coach/prefs")} />
          <WidgetUpcomingRace onOpenDetail={() => router.push("/coach/race-countdown")} />
          <WidgetCoachAIAnalyze onOpenDetail={() => router.push("/coach/ai/athleteState")} />
          <WidgetCoachAIProgress onOpenDetail={() => router.push("/coach/ai/progress")} />
          <WidgetCoachPlanSummary onOpenDetail={() => router.push("/coach/ai/planSummary")} />

          {showAdvanced && (
            <>
              <WidgetExternalEvents />
            </>
          )}
        </div>
      )}
    </PageShell>
  );
}