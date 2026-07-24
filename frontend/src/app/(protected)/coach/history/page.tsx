// src/app/coach/history/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import ListCoachPlanHistory from "@/app/features/coach/components/ListCoachPlanHistory";
import { useT } from "@/app/shared/i18n/useT";

export default function CoachPlanHistoryPage() {
  const t = useT();
  
  return (
    <PageShell 
      title={t("coachPlanHistory.title" as any)} 
      showBack 
      showPoweredByStrava={false}
    >
      <ListCoachPlanHistory />
    </PageShell>
  );
}

