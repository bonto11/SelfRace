// src/app/coach/ai/progress/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import DetailAthleteProgress from "@/app/features/coach/components/DetailAthleteProgress";
import { useT } from "@/app/shared/i18n/useT";

export default function Page() {
  const t = useT();
  return (
    <PageShell title={t("coachProgress.title")} showBack showPoweredByStrava={false}>
      <DetailAthleteProgress />
    </PageShell>
  );
}
