// src/app/coach/ai/daily/page.tsx
"use client";

import ButtonBack from "@/app/shared/components/ui/ButtonBack";
import DetailDailyPlan from "@/app/features/coach/components/DetailDailyPlan";

export default function Page() {
  return (
    <div className="max-w-screen-lg mx-auto px-3">
      <ButtonBack title="Daily plan" />
      <div className="pt-3 pb-6">
        <DetailDailyPlan />
      </div>
    </div>
  );
}
