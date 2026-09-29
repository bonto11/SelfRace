// src/app/coach/advisor/daily/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import DetailDailyPlan from "@/app/features/coach/components/DetailDailyPlan";
import AdvisorReviewCard from "@/app/features/coach/components/AdvisorReviewCard";
import { PANEL_STACK } from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

export default function Page() {
  const t = useT();
  return (
    <PageShell title={t("coachDaily.widget.titleAdvisor")} showBack showPoweredByStrava={false}>
      <div className={PANEL_STACK}>
        <AdvisorReviewCard />
        <DetailDailyPlan editable={true} />
      </div>
    </PageShell>
  );
}