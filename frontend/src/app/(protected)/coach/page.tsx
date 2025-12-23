"use client";

import { useRouter } from "next/navigation";

import WidgetPB from "@/app/shared/components/widgets/WidgetPB";
import WidgetCoachPrefs from "@/app/shared/components/widgets/WidgetCoachPrefs";
import WidgetActivitiesCalendar from "@/app/shared/components/widgets/WidgetActivitiesCalendar";
import WidgetCoachPlan from "@/app/shared/components/widgets/WidgetCoachPlan";
import WidgetExternalEvents from "@/app/shared/components/widgets/WidgetExternalEvents";

import WidgetCoachAIAnalyze from "@/app/shared/components/widgets/WidgetCoachAthleteState";
import WidgetCoachAIWeekly from "@/app/shared/components/widgets/WidgetCoachWeeklyPlan";
import WidgetCoachAIDaily from "@/app/shared/components/widgets/WidgetCoachDailyPlan";

import { CoachDataProvider } from "@/app/shared/components/dataProviders/CoachDataProvider";

function ClientPage() {
  const router = useRouter();

  return (
    <div className="p-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {/* existujúce widgety */}
      <WidgetExternalEvents />
      <WidgetPB onOpenDetail={() => router.push("/coach/pb")} />
      <WidgetCoachPrefs onOpenDetail={() => router.push("/coach/prefs")} />
      <WidgetCoachPlan />
      <WidgetActivitiesCalendar />

      {/* nové AI widgety – zatiaľ statické */}
      <WidgetCoachAIAnalyze
        onOpenDetail={() => router.push("/coach/ai/athleteState")}
      />
      <WidgetCoachAIWeekly
        onOpenDetail={() => router.push("/coach/ai/weeklyPlan")}
      />
      <WidgetCoachAIDaily
        onOpenDetail={() => router.push("/coach/ai/dailyPlan")}
      />
    </div>
  );
}

export default function Page() {
  return (
    <CoachDataProvider>
      <ClientPage />
    </CoachDataProvider>
  );
}
