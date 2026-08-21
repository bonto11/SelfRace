// src/app/(protected)/coach/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/app/shared/ui/components/PageShell";
import { PAGE_GRID_2 } from "@/app/shared/ui/tokens/pageTokens";

import {
  CoachDataProvider,
  useCoachData,
} from "@/app/shared/components/dataProviders/CoachDataProvider";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { apiActivePlanStatus } from "@/app/features/coach/api/coach_plan_active";

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

function ClientPage() {
  const router = useRouter();
  const t = useT();
  const { userId } = useUserId();
  const { settings } = useSettings() as any;
  const showAdvanced = settings?.show_advanced ?? false;

  // 🌟 Poradie widgetov sa mení podľa toho, či má used aktívny plán - keď nie
  // je aktívny, najdôležitejšie je nastaviť prefs a spustiť plán (Prefs hore).
  // Keď je aktívny, najdôležitejšie sú aktuálne treningy (Daily/Weekly hore),
  // keďže prefs a analyzovanie atléta sa už menia len zriedka.
  //
  // WidgetCoachPlanSummary je v OBOCH vetvách - je to čisto UI widget, ktorý
  // sa sám skryje (vráti null), ak pre usera ešte neexistuje žiadny sumár.
  // Je to zámerné: keď sa plán práve dokončí, hasActivePlan sa okamžite
  // prepne na false, takže widget musí byť viditeľný aj v "bez aktívneho
  // plánu" vetve, inak by user svoj čerstvo vygenerovaný sumár nikdy neuvidel.
  const [hasActivePlan, setHasActivePlan] = useState<boolean | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    apiActivePlanStatus(Number(userId))
      .then((s) => {
        if (alive) setHasActivePlan(!!s?.has_active);
      })
      .catch(() => {
        if (alive) setHasActivePlan(false);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

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
          <WidgetCoachAIDaily onOpenDetail={() => router.push("/coach/ai/dailyPlan")} />
          <WidgetCoachAIWeekly onOpenDetail={() => router.push("/coach/ai/weeklyPlan")} />
          <WidgetCoachAIAnalyze onOpenDetail={() => router.push("/coach/ai/athleteState")} />
          <WidgetCoachPlanSummary onOpenDetail={() => router.push("/coach/ai/planSummary")} />

          {showAdvanced && (
            <>
              <WidgetCoachAIProgress onOpenDetail={() => router.push("/coach/ai/progress")} />
              <WidgetCoachNotes onOpenDetail={() => router.push("/coach/notes")} />
              <WidgetAthleteHealth onOpenDetail={() => router.push("/coach/health")} />
              <WidgetExternalEvents />
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

export default function Page() {
  return (
    <CoachDataProvider>
      <ClientPage />
    </CoachDataProvider>
  );
}
