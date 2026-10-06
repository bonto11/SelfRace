// src/app/activities/wrapped/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import DetailActivitiesWrapped from "@/app/features/activities/components/DetailActivitiesWrapped";
import { useT } from "@/app/shared/i18n/useT";
import { activityInfo } from "@/app/features/activities/utils/activityInfo";

export default function Page() {
  const t = useT();
  return (
    <PageShell info={activityInfo(t, "wrapped")} title={t("activitiesWrapped.title")} showBack showPoweredByStrava={false}>
      <DetailActivitiesWrapped />
    </PageShell>
  );
}