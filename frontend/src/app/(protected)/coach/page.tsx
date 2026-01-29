// src/app/(protected)/coach/page.tsx
"use client";

import { useRouter } from "next/navigation";
import PageShell from "@/app/shared/ui/components/PageShell";
import { PAGE_GRID_2 } from "@/app/shared/ui/tokens/pageTokens";

import { CoachDataProvider, useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";

import WidgetPB from "@/app/shared/components/widgets/WidgetPB";
import WidgetCoachPrefs from "@/app/shared/components/widgets/WidgetCoachPrefs";
import WidgetCoachPlan from "@/app/shared/components/widgets/WidgetCoachPlan";
import WidgetExternalEvents from "@/app/shared/components/widgets/WidgetExternalEvents";

import WidgetCoachAIAnalyze from "@/app/shared/components/widgets/WidgetCoachAthleteState";
import WidgetCoachAIWeekly from "@/app/shared/components/widgets/WidgetCoachWeeklyPlan";
import WidgetCoachAIDaily from "@/app/shared/components/widgets/WidgetCoachDailyPlan";
import WidgetCoachAIProgress from "@/app/shared/components/widgets/WidgetCoachProgress";

import Button from "@/app/shared/ui/components/Button";
import IconRefresh from "@/app/shared/svg/Refresh";

function RefreshIconBtn() {
  const { refresh, loading } = useCoachData();

  return (
    <Button
      circle
      size="sm"
      variant="ghost"
      aria-label="Refresh data"
      title="Refresh data"
      onClick={() => refresh(true)}
      disabled={loading}
    >
      <IconRefresh className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
    </Button>
  );
}

function ClientPage() {
  const router = useRouter();

  return (
    <PageShell
      title="Coach"
      showBack={false}
      showPoweredByStrava={false}
      rightSlot={<RefreshIconBtn />}
    >
      <div className={PAGE_GRID_2}>
        {/* existujúce widgety */}
        <WidgetExternalEvents />
        <WidgetPB onOpenDetail={() => router.push("/coach/pb")} />
        <WidgetCoachPrefs onOpenDetail={() => router.push("/coach/prefs")} />
        <WidgetCoachPlan />

        {/* AI widgety */}
        <WidgetCoachAIAnalyze
          onOpenDetail={() => router.push("/coach/ai/athleteState")}
        />
        <WidgetCoachAIWeekly
          onOpenDetail={() => router.push("/coach/ai/weeklyPlan")}
        />
        <WidgetCoachAIDaily
          onOpenDetail={() => router.push("/coach/ai/dailyPlan")}
        />
        <WidgetCoachAIProgress
          onOpenDetail={() => router.push("/coach/ai/progress")}
        />
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