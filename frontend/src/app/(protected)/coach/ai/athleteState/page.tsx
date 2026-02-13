// src/app/coach/ai/athleteState/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import DetailAthleteState from "@/app/features/coach/components/DetailAthleteState";
import { useT } from "@/app/shared/i18n/useT";

export default function Page() {
  const t = useT();
  return (
    <PageShell title={t("coachAthleteState.title")} showBack showPoweredByStrava={false}>
      <DetailAthleteState />
    </PageShell>
  );
}
