// src/app/(protected)/performance/bodyScan/page.tsx
"use client";

import { performanceInfo } from "@/app/features/performance/utils/performanceWidget";
import PageShell from "@/app/shared/ui/components/PageShell";
import DetailBodyScan from "@/app/features/performance/components/DetailBodyScan";
import { useT } from "@/app/shared/i18n/useT";

export default function Page() {
  const t = useT();

  return (
    <PageShell
      info={performanceInfo(t, "bodyScan")}
      title={t("bodyScan.title")} showBack showPoweredByStrava={false}>
      <DetailBodyScan />
    </PageShell>
  );
}