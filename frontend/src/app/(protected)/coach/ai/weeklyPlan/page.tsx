// src/app/coach/ai/weekly/page.tsx
"use client";

import PageShell from "@/app/shared/components/ui/PageShell";
import DetailWeeklyPlan from "@/app/features/coach/components/DetailWeeklyPlan";

export default function Page() {
  return (
    <PageShell title="Weekly plan" showBack>
      <DetailWeeklyPlan />
    </PageShell>
  );
}