// src/app/coach/ai/daily/page.tsx
"use client";

import PageShell from "@/app/shared/components/ui/PageShell";
import DetailDailyPlan from "@/app/features/coach/components/DetailDailyPlan";

export default function Page() {
  return (
    <PageShell title="Daily plan" showBack>
      <DetailDailyPlan />
    </PageShell>
  );
}