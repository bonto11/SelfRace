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
import { useT } from "@/app/shared/i18n/useT";

function RefreshIconBtn() {
  const { refresh, loading } = useActivityData();
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

export default function ActivitiesPage() {
  const router = useRouter();
  const t = useT();

  const openDetailLoad = () => router.push("/activities/load");
  const openDetailMono = () => router.push("/activities/mono");
  const openDetail8020 = () => router.push("/activities/pareto");

  return (
    <PageShell
      title={t("activities.title")}
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
      <a href="/debug" className="text-xs text-gray-500 mt-4 block text-center">
        Diagnostika PWA
      </a>
    </PageShell>
  );
}
