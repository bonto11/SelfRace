// src/app/(protected)/coach/page.tsx
"use client";

import { useRouter } from "next/navigation";
import PageShell from "@/app/shared/ui/components/PageShell";
import { PAGE_GRID_2 } from "@/app/shared/ui/tokens/pageTokens";

import {
  CoachDataProvider,
  useCoachData,
} from "@/app/shared/components/dataProviders/CoachDataProvider";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";


import WidgetUpcomingRace from "@/app/shared/components/widgets/WidgetUpcomingRace";
import WidgetCoachPrefs   from "@/app/shared/components/widgets/WidgetCoachPrefs";
import WidgetCoachPlan    from "@/app/shared/components/widgets/WidgetCoachPlan";
import WidgetExternalEvents from "@/app/shared/components/widgets/WidgetExternalEvents";
import WidgetAthleteHealth  from "@/app/shared/components/widgets/WidgetAthleteHealth";
import WidgetCoachAIAnalyze  from "@/app/shared/components/widgets/WidgetCoachAthleteState";
import WidgetCoachAIWeekly   from "@/app/shared/components/widgets/WidgetCoachWeeklyPlan";
import WidgetCoachAIDaily    from "@/app/shared/components/widgets/WidgetCoachDailyPlan";
import WidgetCoachAIProgress from "@/app/shared/components/widgets/WidgetCoachProgress";
import WidgetCoachPlanCompliance from "@/app/shared/components/widgets/WidgetCoachPlanCompliance";
import WidgetCoachNotes from "@/app/shared/components/widgets/WidgetCoachNotes";

import Button from "@/app/shared/ui/components/Button";
import IconRefresh from "@/app/shared/svg/Refresh";
import ShowAdvancedToggle from "@/app/shared/ui/components/ShowAdvancedToggle";
import { useT } from "@/app/shared/i18n/useT";

function RefreshIconBtn() {
  const t = useT();
  const { refresh: refreshActivities, loading: loadingActivities } = useActivityData();
  const { refresh: refreshCoach, loading: loadingCoach } = useCoachData();
  const isGlobalLoading = loadingActivities || loadingCoach;

  return (
    <Button circle size="sm" variant="ghost"
      aria-label={t("common.refreshTitle" as any)}
      title={t("common.refreshTitle" as any)}
      onClick={() => { refreshActivities(true); refreshCoach(true); }}
      disabled={isGlobalLoading}
    >
      <IconRefresh className={`h-4 w-4 ${isGlobalLoading ? "animate-spin" : ""}`} />
    </Button>
  );
}

function ClientPage() {
  const router = useRouter();
  const t = useT();
  const { settings } = useSettings() as any;
  const showAdvanced = settings?.show_advanced ?? false;

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

      <div className={PAGE_GRID_2}>
        <WidgetUpcomingRace
          onOpenDetail={() => router.push("/coach/race-countdown")}
        />

        {showAdvanced && <WidgetExternalEvents />}

        <WidgetCoachPrefs    onOpenDetail={() => router.push("/coach/prefs")} />
        <WidgetAthleteHealth onOpenDetail={() => router.push("/coach/health")} />
        <WidgetCoachPlan />
        <WidgetCoachAIAnalyze onOpenDetail={() => router.push("/coach/ai/athleteState")} />
        <WidgetCoachAIWeekly  onOpenDetail={() => router.push("/coach/ai/weeklyPlan")} />
        <WidgetCoachAIDaily   onOpenDetail={() => router.push("/coach/ai/dailyPlan")} />

        {showAdvanced && (
          <>
            <WidgetCoachNotes onOpenDetail={() => router.push("/coach/notes")} />
            <WidgetCoachAIProgress   onOpenDetail={() => router.push("/coach/ai/progress")} />
            <WidgetCoachPlanCompliance onOpenDetail={() => router.push("/coach/compliance")} />
          </>
        )}
      </div>
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