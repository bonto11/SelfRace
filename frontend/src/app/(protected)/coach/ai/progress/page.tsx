// src/app/coach/ai/progress/page.tsx
"use client";

import AppHeader from "@/app/shared/components/ui/AppHeader";
import { PAGE_CONTAINER, PAGE_STACK } from "@/app/shared/ui/tokens/pageTokens";
import DetailAthleteProgress from "@/app/features/coach/components/DetailAthleteProgress";

export default function Page() {
  return (
    <>
      <AppHeader title="Weekly progress" showBack container />

      <div className={PAGE_CONTAINER}>
        <div className={PAGE_STACK}>
          <DetailAthleteProgress />
        </div>
      </div>
    </>
  );
}