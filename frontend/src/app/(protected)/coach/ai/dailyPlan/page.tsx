// src/app/coach/ai/dailyPlan/page.tsx
"use client";

import { coachInfo } from "@/app/features/coach/utils/coachInfo";
import PageShell from "@/app/shared/ui/components/PageShell";
import DetailDailyPlan from "@/app/features/coach/components/DetailDailyPlan";
import { useT } from "@/app/shared/i18n/useT";

export default function Page() {
  const t = useT();
  return (
    <PageShell
      info={coachInfo(t, "daily")}
      title={t("coachDaily.title")} showBack showPoweredByStrava={false}>
      <DetailDailyPlan editable={false} />
    </PageShell>
  );
}