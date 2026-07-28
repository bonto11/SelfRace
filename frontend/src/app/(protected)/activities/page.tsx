// src/app/(protected)/activities/page.tsx
"use client";

import { useRouter } from "next/navigation";
import PageShell from "@/app/shared/ui/components/PageShell";
import { PAGE_GRID_2 } from "@/app/shared/ui/tokens/pageTokens";

import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";

import WidgetStreak from "@/app/shared/components/widgets/WidgetStreak";
import WeeklyLoadWidget from "@/app/shared/components/widgets/WidgetWeeklyLoad";
import MonoStrainWidget from "@/app/shared/components/widgets/WidgetMonoStrain";
import WidgetPareto8020 from "@/app/shared/components/widgets/WidgetPareto8020";
import WidgetActivitiesCalendar from "@/app/shared/components/widgets/WidgetActivitiesCalendar";
import WidgetMonthlySummary from "@/app/shared/components/widgets/WidgetMonthlySummary";
import WidgetRouteMatch from "@/app/shared/components/widgets/WidgetRouteMatch";
import WidgetLastActivity from "@/app/shared/components/widgets/WidgetLastActivity";

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

  return (
    <PageShell
      title={t("activities.title")}
      showBack={false}
      showPoweredByStrava
      rightSlot={<RefreshIconBtn />}
    >
      <div className={PAGE_GRID_2}>
        <WidgetLastActivity
          onOpenDetail={(activityId) =>
            router.push(`/activities/session/${activityId}`)
          }
        />
        <WidgetStreak onOpenDetail={() => router.push("/activities/streak")} />
        <WidgetMonthlySummary
          onOpenDetail={() => router.push("/activities/monthlySummary")}
        />
        <WeeklyLoadWidget
          onOpenDetail={() => router.push("/activities/load")}
        />
        <MonoStrainWidget
          onOpenDetail={() => router.push("/activities/mono")}
        />
        <WidgetPareto8020
          onOpenTrend={() => router.push("/activities/pareto")}
          weeks={2}
        />
        <WidgetRouteMatch onOpenDetail={() => router.push("/activities/routes")} />
        <WidgetActivitiesCalendar />
      </div>
    </PageShell>
  );
}
