// src/app/coach/ai/daily/page.tsx  (alebo kam to routuješ)
"use client";

import ButtonBack from "@/shared/components/ui/ButtonBack";
import { PlanDataProvider } from "@/shared/components/dataProviders/PlanDataProvider";
import DetailDailyPlan from "@/features/coach/components/DetailDailyPlan";

export default function Page() {
  return (
    <PlanDataProvider>
      <div className="max-w-screen-lg mx-auto px-3">
        <ButtonBack title="Daily plan" />
        <div className="pt-3 pb-6">
          <DetailDailyPlan />
        </div>
      </div>
    </PlanDataProvider>
  );
}