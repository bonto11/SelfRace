// src/app/coach/ai/weekly/page.tsx
"use client";

import AppHeader from "@/app/shared/components/ui/AppHeader";
import { PAGE_CONTAINER, PAGE_STACK } from "@/app/shared/ui/tokens/pageTokens";
import DetailWeeklyPlan from "@/app/features/coach/components/DetailWeeklyPlan";

export default function Page() {
  return (
    <>
      <AppHeader title="Weekly plan" showBack container />

      <div className={PAGE_CONTAINER}>
        <div className={PAGE_STACK}>
          <DetailWeeklyPlan />
        </div>
      </div>
    </>
  );
}