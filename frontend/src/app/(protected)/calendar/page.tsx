"use client";

import ActivitiesCalendar from "@/app/features/calendar/ActivitiesCalendar";
import AppHeader from "@/app/shared/components/ui/AppHeader";
import { PAGE_CONTAINER, PAGE_STACK } from "@/app/shared/ui/tokens/pageTokens";

export default function CalendarPage() {
  return (
     <AppHeader title="Kalendár" showBack={false} container/>
    <div className={PAGE_CONTAINER}>
      <div className={PAGE_STACK}>
        <ActivitiesCalendar />
      </div>
    </div>
  );
}
