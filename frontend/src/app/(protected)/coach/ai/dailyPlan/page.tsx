// src/app/coach/ai/daily/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import DetailDailyPlan from "@/app/features/coach/components/DetailDailyPlan";

export default function Page() {
  return (
    <PageShell title="Daily plan" showBack showPoweredByStrava={false}>
      <DetailDailyPlan />
    </PageShell>
  );
}
