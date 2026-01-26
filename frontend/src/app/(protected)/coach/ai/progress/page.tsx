// src/app/coach/ai/progress/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import DetailAthleteProgress from "@/app/features/coach/components/DetailAthleteProgress";

export default function Page() {
  return (
    <PageShell title="Weekly progress" showBack>
      <DetailAthleteProgress />
    </PageShell>
  );
}
