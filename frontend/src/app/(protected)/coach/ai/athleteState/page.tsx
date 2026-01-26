// src/app/coach/ai/athleteState/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import DetailAthleteState from "@/app/features/coach/components/DetailAthleteState";

export default function Page() {
  return (
    <PageShell title="Athlete state" showBack>
      <DetailAthleteState />
    </PageShell>
  );
}
