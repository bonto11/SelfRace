// src/app/(protected)/calendar/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import ActivitiesCalendar from "@/app/features/calendar/ActivitiesCalendar";
import { useT } from "@/app/shared/i18n/useT";
import Button from "@/app/shared/ui/components/Button";
import IconRefresh from "@/app/shared/svg/Refresh";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";

function CalendarRefreshBtn() {
  const t = useT();
  
  // Vytiahneme refresh funkcie a loading stavy z oboch providerov
  const { refresh: refreshActivities, loading: loadingActivities } = useActivityData();
  const { refresh: refreshCoach, loading: loadingCoach } = useCoachData();

  // Celkový loading je true, ak sa aspoň jeden provider práve načítava
  const isGlobalLoading = loadingActivities || loadingCoach;

  // Funkcia, ktorá spustí oba refreshe naraz
  const handleRefreshAll = () => {
    refreshActivities(true);
    refreshCoach(true);
  };

  return (
    <Button
      circle
      size="sm"
      variant="ghost"
      aria-label={t("common.refreshTitle" as any)}
      title={t("common.refreshTitle" as any)}
      onClick={handleRefreshAll}
      disabled={isGlobalLoading}
    >
      <IconRefresh className={`h-4 w-4 ${isGlobalLoading ? "animate-spin" : ""}`} />
    </Button>
  );
}

export default function CalendarPage() {
  const t = useT();
  return (
    <PageShell 
      title={t("calendar.title")} 
      showBack={false} 
      showPoweredByStrava={true}
      rightSlot={<CalendarRefreshBtn />}
    >
      <ActivitiesCalendar />
    </PageShell>
  );
}
