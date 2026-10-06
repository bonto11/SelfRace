// src/app/(protected)/performance/estTopPaces/page.tsx
"use client";

import { performanceInfo } from "@/app/features/performance/utils/performanceWidget";
import PageShell from "@/app/shared/ui/components/PageShell";
import TrendEstTopPaces from "@/app/features/performance/components/TrendEstTopPaces";
import { useT } from "@/app/shared/i18n/useT";

export default function Page() {
  const t = useT();

  return (
    <PageShell
      info={performanceInfo(t, "estTopPaces")}
      title={t("estTopPaces.title")} showBack showPoweredByStrava={false}>
      <TrendEstTopPaces />
    </PageShell>
  );
}
