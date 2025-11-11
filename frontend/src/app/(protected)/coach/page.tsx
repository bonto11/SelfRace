"use client";

import { useRouter } from "next/navigation";

import WidgetPB from "@/features/widgets/WidgetPB";
import WidgetCoachPrefs from "@/features/widgets/WidgetCoachPrefs";
import WidgetActivitiesCalendar from "@/features/widgets/WidgetActivitiesCalendar";
import WidgetCoachPlan from "@/features/widgets/WidgetCoachPlan";

import { CoachDataProvider } from "@/shared/components/dataProviders/CoachDataProvider";

function ClientPage() {
  const router = useRouter();

  return (
    <div className="p-4 grid gap-4 md:grid-cols-2">
      <WidgetPB onOpenDetail={() => router.push("/coach/pb")} />
      <WidgetCoachPrefs onOpenDetail={() => router.push("/coach/prefs")} />
      <WidgetCoachPlan onOpenDetail={() => router.push("/coach/plan")}/>
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