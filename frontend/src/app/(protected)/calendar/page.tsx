// src/app/(protected)/calendar/page.tsx
"use client";

import PageShell from "@/app/shared/components/ui/PageShell";
import ActivitiesCalendar from "@/app/features/calendar/ActivitiesCalendar";

export default function CalendarPage() {
  return (
    <PageShell title="Kalendár" showBack={false}>
      <ActivitiesCalendar />
    </PageShell>
  );
}