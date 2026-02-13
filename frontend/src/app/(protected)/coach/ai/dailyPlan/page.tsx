// src/app/coach/ai/daily/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import DetailDailyPlan from "@/app/features/coach/components/DetailDailyPlan";
import { useT } from "@/app/shared/i18n/useT";

export default function Page() {
  const t = useT();
  return (
    <PageShell title={t("coachDaily.title")} showBack showPoweredByStrava={false}>
      <DetailDailyPlan />
    </PageShell>
  );
}
