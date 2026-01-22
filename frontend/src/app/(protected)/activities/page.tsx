"use client";

import { useRouter } from "next/navigation";
import AppHeader from "@/app/shared/components/ui/AppHeader";
import { PAGE_CONTAINER } from "@/app/shared/ui/tokens/pageTokens";

import WeeklyLoadWidget from "@/app/shared/components/widgets/WidgetWeeklyLoad";
import MonoStrainWidget from "@/app/shared/components/widgets/WidgetMonoStrain";
import WidgetPareto8020 from "@/app/shared/components/widgets/WidgetPareto8020";
import WidgetActivitiesCalendar from "@/app/shared/components/widgets/WidgetActivitiesCalendar";

export default function ActivitiesPage() {
  const router = useRouter();

  const openDetailLoad = () => router.push("/activities/load");
  const openDetailMono = () => router.push("/activities/mono");
  const openDetail8020 = () => router.push("/activities/pareto");

  return (
    <>
      <AppHeader title="Aktivity" showBack={false} container />

      <div className={PAGE_CONTAINER}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          <WeeklyLoadWidget onOpenDetail={openDetailLoad} />
          <MonoStrainWidget onOpenDetail={openDetailMono} />
          <WidgetPareto8020 onOpenTrend={openDetail8020} weeks={2} />
          <WidgetActivitiesCalendar />
        </div>
      </div>
    </>
  );
}