// src/app/coach/advisor/daily/page.tsx
"use client";

import { coachInfo } from "@/app/features/coach/utils/coachInfo";
import PageShell from "@/app/shared/ui/components/PageShell";
import { useT } from "@/app/shared/i18n/useT";
import { PANEL_STACK } from "@/app/shared/ui/tokens";
import DetailDailyPlan from "@/app/features/coach/components/DetailDailyPlan";
import AdvisorReviewCard from "@/app/features/coach/components/AdvisorReviewCard";

export default function Page() {
  const t = useT();
  return (
    <PageShell
      info={coachInfo(t, "daily")}
      title={t("coachDaily.widget.titleAdvisor")}
      showBack
      showPoweredByStrava={false}
    >
      <div className={PANEL_STACK}>
        {/* Tréningy sú na tejto stránke hlavná vec - idú prvé. */}
        <DetailDailyPlan editable={true} />
        <AdvisorReviewCard />
      </div>
    </PageShell>
  );
}