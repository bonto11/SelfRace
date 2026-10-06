// src/app/coach/ai/weekly/page.tsx
"use client";

import { coachInfo } from "@/app/features/coach/utils/coachInfo";
import PageShell from "@/app/shared/ui/components/PageShell";
import DetailWeeklyPlan from "@/app/features/coach/components/DetailWeeklyPlan";
import { useT } from "@/app/shared/i18n/useT";

export default function Page() {
  const t = useT();
  return (
    <PageShell
      info={coachInfo(t, "weekly")}
      title={t("coachWeekly.title")} showBack showPoweredByStrava={false}>
      <DetailWeeklyPlan />
    </PageShell>
  );
}
