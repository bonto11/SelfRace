"use client";

import ActivitiesCalendar from "@/app/features/calendar/ActivitiesCalendar";
import ButtonBack from "@/app/shared/components/ui/AppHeader";
import { PAGE_CONTAINER, PAGE_STACK } from "@/app/shared/ui/tokens/pageTokens";

export default function CalendarPage() {
  return (
    <div className={PAGE_CONTAINER}>
      <div className={PAGE_STACK}>
        <ButtonBack title="Kalendár" showBack={false} container/>
        <ActivitiesCalendar />
      </div>
    </div>
  );
}
