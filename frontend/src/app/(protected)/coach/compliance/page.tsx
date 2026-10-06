"use client";

import { coachInfo } from "@/app/features/coach/utils/coachInfo";
import PageShell from "@/app/shared/ui/components/PageShell";
import { useT } from "@/app/shared/i18n/useT";
import DetailPlanCompliance from "@/app/features/coach/components/DetailPlanCompliance";

export default function PlanCompliancePage() {
  const t = useT();

  return (
    <PageShell
      info={coachInfo(t, "compliance")}
      title={t("coachCompliance.stats.title")}
      showBack
      showPoweredByStrava={false}
    >
      <DetailPlanCompliance />
    </PageShell>
  );
}
