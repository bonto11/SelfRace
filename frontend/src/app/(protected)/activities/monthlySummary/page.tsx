// src/app/(protected)/activities/monthlySummary/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import DetailMonthlySummary from "@/app/features/activities/components/DetailMonthlySummary";
import { useT } from "@/app/shared/i18n/useT";

export default function Page() {
  const t = useT();
  return (
    <PageShell
      title={t("monthlySummary.title") as any}
      showBack
      showPoweredByStrava
    >
      <DetailMonthlySummary />
    </PageShell>
  );
}