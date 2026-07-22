// src/app/(protected)/performance/bodyScan/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import DetailBodyScan from "@/app/features/performance/components/DetailBodyScan";
import { useT } from "@/app/shared/i18n/useT";

export default function Page() {
  const t = useT();

  return (
    <PageShell title={t("bodyScan.title")} showBack showPoweredByStrava={false}>
      <DetailBodyScan />
    </PageShell>
  );
}