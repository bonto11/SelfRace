// src/app/coach/ai/planSummary/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import DetailPlanSummary from "@/app/features/coach/components/DetailPlanSummary";
import { useT } from "@/app/shared/i18n/useT";

export default function Page() {
  const t = useT();
  return (
    <PageShell title={t("coachPlanSummary.title")} showBack showPoweredByStrava={false}>
      <DetailPlanSummary />
    </PageShell>
  );
}