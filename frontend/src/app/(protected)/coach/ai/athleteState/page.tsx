// src/app/coach/ai/athleteState/page.tsx
"use client";

import AppHeader from "@/app/shared/components/ui/AppHeader";
import { PAGE_CONTAINER, PAGE_STACK } from "@/app/shared/ui/tokens/pageTokens";
import DetailAthleteState from "@/app/features/coach/components/DetailAthleteState";

export default function Page() {
  return (
    <>
      <AppHeader title="Athlete state" showBack container />

      <div className={PAGE_CONTAINER}>
        <div className={PAGE_STACK}>
          <DetailAthleteState />
        </div>
      </div>
    </>
  );
}