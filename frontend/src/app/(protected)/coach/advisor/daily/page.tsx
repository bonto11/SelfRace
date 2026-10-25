// src/app/coach/advisor/daily/page.tsx
"use client";

import { coachInfo } from "@/app/features/coach/utils/coachInfo";
import PageShell from "@/app/shared/ui/components/PageShell";
import { useT } from "@/app/shared/i18n/useT";
import { useFeature } from "@/app/shared/state/featureFlagsStore";
import { PANEL_STACK } from "@/app/shared/ui/tokens";
import DetailDailyPlan from "@/app/features/coach/components/DetailDailyPlan";
import AdvisorReviewCard from "@/app/features/coach/components/AdvisorReviewCard";
import SeasonPlanCard from "@/app/features/coach/components/SeasonPlanCard";

export default function Page() {
  const t = useT();
  const seasonOn = useFeature("season_plan");
  return (
    <PageShell
      info={coachInfo(t, "daily") + (seasonOn ? `\n\n${t("seasonPlan.dailyInfoLine")}` : "")}
      title={t("coachDaily.widget.titleAdvisor")}
      showBack
      showPoweredByStrava={false}
    >
      <div className={PANEL_STACK}>
        {/* Tréningy sú na tejto stránke hlavná vec - idú prvé. */}
        <DetailDailyPlan editable={true} />
        {/* kostra obdobia – téma týždňa, z ktorej user skladá tréningy */}
        <SeasonPlanCard />
        <AdvisorReviewCard />
      </div>
    </PageShell>
  );
}