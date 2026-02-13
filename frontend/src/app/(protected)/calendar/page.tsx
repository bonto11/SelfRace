// src/app/(protected)/calendar/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import ActivitiesCalendar from "@/app/features/calendar/ActivitiesCalendar";
import { useT } from "@/app/shared/i18n/useT";

export default function CalendarPage() {
  const t = useT();
  return (
    <PageShell title={t("calendar.title")} showBack={false} showPoweredByStrava={true}>
      <ActivitiesCalendar />
    </PageShell>
  );
}
