// src/app/activities/wrapped/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import DetailActivitiesWrapped from "@/app/features/activities/components/DetailActivitiesWrapped";
import { useT } from "@/app/shared/i18n/useT";

export default function Page() {
  const t = useT();
  return (
    <PageShell title={t("activitiesWrapped.title")} showBack showPoweredByStrava={false}>
      <DetailActivitiesWrapped />
    </PageShell>
  );
}