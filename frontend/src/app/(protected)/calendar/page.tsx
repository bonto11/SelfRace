"use client";

import ActivitiesCalendar from "@/shared/components/calendar/ActivitiesCalendar";
import { ActivityDataProvider } from "@/shared/components/dataProviders/ActivityDataProvider";
import ButtonBack from "@/shared/components/ui/ButtonBack";

export default function CalendarPage() {
  return (
    <div className="max-w-screen-xl mx-auto px-3">
      <div className="flex items-center justify-between mb-3">
        <ButtonBack fallbackHref="/dashboard" title="Kalendár aktivít" />
      </div>

      <ActivityDataProvider days={120}>
        <ActivitiesCalendar />
      </ActivityDataProvider>
    </div>
  );
}