// src/app/(protected)/activities/page.tsx
"use client";

import { useRouter } from "next/navigation";
import PageShell from "@/app/shared/ui/components/PageShell";
import { PAGE_GRID_2 } from "@/app/shared/ui/tokens/pageTokens";

import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";

import WeeklyLoadWidget from "@/app/shared/components/widgets/WidgetWeeklyLoad";
import MonoStrainWidget from "@/app/shared/components/widgets/WidgetMonoStrain";
import WidgetPareto8020 from "@/app/shared/components/widgets/WidgetPareto8020";
import WidgetActivitiesCalendar from "@/app/shared/components/widgets/WidgetActivitiesCalendar";

import Button from "@/app/shared/ui/components/Button";
import IconRefresh from "@/app/shared/svg/Refresh";

function RefreshIconBtn() {
  const { refresh, loading } = useActivityData();

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

export default function ActivitiesPage() {
  const router = useRouter();

  const openDetailLoad = () => router.push("/activities/load");
  const openDetailMono = () => router.push("/activities/mono");
  const openDetail8020 = () => router.push("/activities/pareto");

  return (
    <PageShell
      title="Aktivity"
      showBack={false}
      showPoweredByStrava
      rightSlot={<RefreshIconBtn />}
    >
      <div className={PAGE_GRID_2}>
        <WeeklyLoadWidget onOpenDetail={openDetailLoad} />
        <MonoStrainWidget onOpenDetail={openDetailMono} />
        <WidgetPareto8020 onOpenTrend={openDetail8020} weeks={2} />
        <WidgetActivitiesCalendar />
      </div>
    </PageShell>
  );
}