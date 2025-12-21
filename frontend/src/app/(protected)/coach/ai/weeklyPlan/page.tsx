// src/app/coach/ai/weekly/page.tsx  (alebo tvoja aktuálna cesta)
"use client";

import ButtonBack from "@/app/shared/components/ui/ButtonBack";
import DetailWeeklyPlan from "@/app/features/coach/components/DetailWeeklyPlan";

export default function Page() {
  return (
    <div className="max-w-screen-lg mx-auto px-3">
      <ButtonBack title="Weekly plan" />

      <div className="pt-3 pb-6">
        <DetailWeeklyPlan />
      </div>
    </div>
  );
}
