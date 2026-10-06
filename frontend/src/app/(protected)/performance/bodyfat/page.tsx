// src/app/(protected)/trends/bodyfat/page.tsx
"use client";

import { performanceInfo } from "@/app/features/performance/utils/performanceWidget";
import PageShell from "@/app/shared/ui/components/PageShell";
import TrendBodyFat from "@/app/features/performance/components/TrendBodyFat";
import { useT } from "@/app/shared/i18n/useT";

export default function Page() {
  const t = useT();

  return (
    <PageShell
      info={performanceInfo(t, "bodyFat")}
      title={t("bodyFat.title")} showBack showPoweredByStrava={false}>
      <TrendBodyFat />
    </PageShell>
  );
}
