// src/app/(protected)/coach/page.tsx
"use client";

import { useEffect } from "react";
import PageShell from "@/app/shared/ui/components/PageShell";

import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import WidgetGrid from "@/app/shared/widgets/WidgetGrid";
import type { WidgetId } from "@/app/shared/widgets/widgetCatalog";

import Button from "@/app/shared/ui/components/Button";
import IconRefresh from "@/app/shared/svg/Refresh";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useT } from "@/app/shared/i18n/useT";

// Aktívny plán: hore to, čo je práve najviac potrebné. Widgety, ktoré bez
// plánu (alebo v advisor režime) nemajú čo ukázať, odfiltruje katalóg (needs).
const ORDER_ACTIVE_PLAN: WidgetId[] = [
  "race",
  "daily_plan",
  "advisor",
  "weekly_plan",
  "athlete_state",
  "plan_summary",
  "progress",
  "notes",
  "health",
  "external_events",
  "compliance",
  "coach_prefs",
];

// Bez plánu: nastavenie a spustenie hore.
const ORDER_NO_PLAN: WidgetId[] = [
  "coach_prefs",
  "advisor",
  "race",
  "athlete_state",
  "progress",
  "plan_summary",
  "external_events",
];

function RefreshIconBtn() {
  const t = useT();
  const { refresh: refreshActivities, loading: loadingActivities } = useActivityData();
  const { refresh: refreshCoach, loading: loadingCoach } = useCoachData();
  const isGlobalLoading = loadingActivities || loadingCoach;

  return (
    <Button
      circle
      size="sm"
      variant="ghost"
      aria-label={t("common.refreshTitle" as any)}
      title={t("common.refreshTitle" as any)}
      onClick={() => {
        refreshActivities(true);
        refreshCoach(true);
      }}
      disabled={isGlobalLoading}
    >
      <IconRefresh className={`h-4 w-4 ${isGlobalLoading ? "animate-spin" : ""}`} />
    </Button>
  );
}

export default function Page() {
  const t = useT();
  const { weekly, plan, activePlanStatus } = useCoachData();

  // Stav plánu drží coach provider (cache + zdieľaný request s onboardingom).
  // Pri zmene plánu sa overí znova - ensure() reálne načíta len keď prebehol
  // zápis na BE (generovanie, zrušenie plánu) alebo sú dáta staré.
  useEffect(() => {
    activePlanStatus.ensure();
  }, [activePlanStatus.ensure, weekly.plan, plan.rows]);
  const hasActivePlan: boolean | null = activePlanStatus.loaded
    ? !!activePlanStatus.data?.has_active
    : null;

  return (
    <PageShell
      title={t("coach.title")}
      showBack={false}
      showPoweredByStrava={false}
      rightSlot={<RefreshIconBtn />}
    >
      {hasActivePlan === null ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner size="trend" />
        </div>
      ) : (
        <WidgetGrid section="coach" order={hasActivePlan ? ORDER_ACTIVE_PLAN : ORDER_NO_PLAN} />
      )}
    </PageShell>
  );
}
