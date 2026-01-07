"use client";

import { useRouter } from "next/navigation";
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
      <div className="sticky top-[max(env(safe-area-inset-top),0px)] z-20 -mx-3 px-3 pt-2 pb-2 bg-black/60 backdrop-blur supports-[backdrop-filter]:bg-black/40">
        <div className="max-w-screen-lg mx-auto flex items-center gap-3">
          <h1 className="text-lg font-semibold truncate">Aktivity</h1>
          {/* žiadne tlačidlá, len title */}
        </div>
      </div>

      <div className="max-w-screen-lg mx-auto px-3">
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