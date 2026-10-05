// src/app/(protected)/activities/monthlySummary/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import DetailMonthlySummary from "@/app/features/activities/components/DetailMonthlySummary";
import { useT } from "@/app/shared/i18n/useT";
import { activityInfo } from "@/app/features/activities/utils/activityInfo";

export default function Page() {
  const t = useT();
  return (
    <PageShell
      info={activityInfo(t, "monthly")}
      title={t("monthlySummary.title") as any}
      showBack
      showPoweredByStrava
    >
      <DetailMonthlySummary />
    </PageShell>
  );
}