// src/app/coach/ai/daily/page.tsx
"use client";

import AppHeader from "@/app/shared/components/ui/AppHeader";
import { PAGE_CONTAINER, PAGE_STACK } from "@/app/shared/ui/tokens/pageTokens";
import DetailDailyPlan from "@/app/features/coach/components/DetailDailyPlan";

export default function Page() {
  return (
    <>
      <AppHeader title="Daily plan" showBack container />

      <div className={PAGE_CONTAINER}>
        <div className={PAGE_STACK}>
          <DetailDailyPlan />
        </div>
      </div>
    </>
  );
}