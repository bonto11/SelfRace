"use client";

import ActivitiesCalendar from "@/shared/components/calendar/ActivitiesCalendar";
import ButtonBack from "@/shared/components/ui/ButtonBack";

export default function CalendarPage() {
  return (
    <div className="max-w-screen-xl mx-auto px-3">
      <ButtonBack title="Kalendár aktivít" />
      <ActivitiesCalendar />
    </div>
  );
}
