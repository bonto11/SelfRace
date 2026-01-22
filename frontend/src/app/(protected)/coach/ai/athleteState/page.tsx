// src/app/coach/ai/athleteState/page.tsx
"use client";

import ButtonBack from "@/app/shared/components/ui/AppHeader";
import DetailAthleteState from "@/app/features/coach/components/DetailAthleteState";

export default function Page() {
  return (
    <div className="max-w-screen-lg mx-auto px-3">
      <ButtonBack title="Athlete state" />

      <div className="pt-3">
        <DetailAthleteState />
      </div>
    </div>
  );
}
