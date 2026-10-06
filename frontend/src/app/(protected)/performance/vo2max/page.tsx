// src/app/(protected)/trends/vo2max/page.tsx
"use client";

import { performanceInfo } from "@/app/features/performance/utils/performanceWidget";
import PageShell from "@/app/shared/ui/components/PageShell";
import TrendVO2Max from "@/app/features/performance/components/TrendVO2Max";
import { useT } from "@/app/shared/i18n/useT";

export default function Page() {
  const t = useT();

  return (
    <PageShell
      info={performanceInfo(t, "vo2max")}
      title={t("VO2Max.title")} showBack showPoweredByStrava={false}>
      <TrendVO2Max />
    </PageShell>
  );
}
