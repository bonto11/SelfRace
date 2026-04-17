// src/app/(protected)/coach/page.tsx
"use client";

import { useRouter } from "next/navigation";
import PageShell from "@/app/shared/ui/components/PageShell";
import { PAGE_GRID_2 } from "@/app/shared/ui/tokens/pageTokens";

import {
  CoachDataProvider,
  useCoachData,
} from "@/app/shared/components/dataProviders/CoachDataProvider";

import WidgetCoachPrefs from "@/app/shared/components/widgets/WidgetCoachPrefs";
import WidgetCoachPlan from "@/app/shared/components/widgets/WidgetCoachPlan";
import WidgetExternalEvents from "@/app/shared/components/widgets/WidgetExternalEvents";

import WidgetAthleteHealth from "@/app/shared/components/widgets/WidgetAthleteHealth";
import WidgetCoachAIAnalyze from "@/app/shared/components/widgets/WidgetCoachAthleteState";
import WidgetCoachAIWeekly from "@/app/shared/components/widgets/WidgetCoachWeeklyPlan";
import WidgetCoachAIDaily from "@/app/shared/components/widgets/WidgetCoachDailyPlan";
import WidgetCoachAIProgress from "@/app/shared/components/widgets/WidgetCoachProgress";

import Button from "@/app/shared/ui/components/Button";
import IconRefresh from "@/app/shared/svg/Refresh";
import ShowAdvancedToggle from "@/app/shared/ui/components/ShowAdvancedToggle";
import { useT } from "@/app/shared/i18n/useT";
import { useSettings } from "@/app/shared/i18n/SettingsProvider"; 

function RefreshIconBtn() {
  const { refresh, loading } = useCoachData();
  const t = useT();

  return (
    <Button
      circle
      size="sm"
      variant="ghost"
      aria-label={t("common.refreshTitle")}
      title={t("common.refreshTitle")}
      onClick={() => refresh(true)}
      disabled={loading}
    >
      <IconRefresh className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
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
        {showAdvanced && <WidgetExternalEvents />}

        <WidgetCoachPrefs onOpenDetail={() => router.push("/coach/prefs")} />

        <WidgetAthleteHealth
          onOpenDetail={() => router.push("/coach/health")}
        />

        <WidgetCoachPlan />

        <WidgetCoachAIAnalyze
          onOpenDetail={() => router.push("/coach/ai/athleteState")}
        />
        <WidgetCoachAIWeekly
          onOpenDetail={() => router.push("/coach/ai/weeklyPlan")}
        />
        <WidgetCoachAIDaily
          onOpenDetail={() => router.push("/coach/ai/dailyPlan")}
        />
        
        {/* Progress presunutý za showAdvanced podmienku */}
        {showAdvanced && (
          <WidgetCoachAIProgress
            onOpenDetail={() => router.push("/coach/ai/progress")}
          />
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
