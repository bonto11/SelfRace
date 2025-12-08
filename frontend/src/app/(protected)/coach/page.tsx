"use client";

import { useRouter } from "next/navigation";

import WidgetPB from "@/shared/components/widgets/WidgetPB";
import WidgetCoachPrefs from "@/shared/components/widgets/WidgetCoachPrefs";
import WidgetActivitiesCalendar from "@/shared/components/widgets/WidgetActivitiesCalendar";
import WidgetCoachPlan from "@/shared/components/widgets/WidgetCoachPlan";

import WidgetCoachAIAnalyze from "@/shared/components/widgets/WidgetCoachAIAnalyze";
import WidgetCoachAIWeekly from "@/shared/components/widgets/WidgetCoachAIWeekly";
import WidgetCoachAIDaily from "@/shared/components/widgets/WidgetCoachAIDaily";

import { CoachDataProvider } from "@/shared/components/dataProviders/CoachDataProvider";

function ClientPage() {
  const router = useRouter();

  return (
    <div className="p-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {/* existujúce widgety */}
      <WidgetPB onOpenDetail={() => router.push("/coach/pb")} />
      <WidgetCoachPrefs onOpenDetail={() => router.push("/coach/prefs")} />
      <WidgetCoachPlan onOpenDetail={() => router.push("/coach/plan")} />
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