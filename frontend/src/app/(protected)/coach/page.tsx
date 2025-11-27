"use client";

import { useRouter } from "next/navigation";

import WidgetPB from "@/shared/components/widgets/WidgetPB";
import WidgetCoachPrefs from "@/shared/components/widgets/WidgetCoachPrefs";
import WidgetActivitiesCalendar from "@/shared/components/widgets/WidgetActivitiesCalendar";
import WidgetCoachPlan from "@/shared/components/widgets/WidgetCoachPlan";

import { CoachDataProvider } from "@/shared/components/dataProviders/CoachDataProvider";

function ClientPage() {
  const router = useRouter();

  return (
    <div className="p-4 grid gap-4 md:grid-cols-2">
      <WidgetPB onOpenDetail={() => router.push("/coach/pb")} />
      <WidgetCoachPrefs onOpenDetail={() => router.push("/coach/prefs")} />
      <WidgetCoachPlan onOpenDetail={() => router.push("/coach/plan")} />
      <WidgetActivitiesCalendar />
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
