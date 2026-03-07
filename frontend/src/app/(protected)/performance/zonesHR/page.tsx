// src/app/(protected)/performance/zonesHR/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import TrendZonesHR from "@/app/features/performance/components/TrendZonesHR";
import { useT } from "@/app/shared/i18n/useT";

export default function Page() {
  const t = useT();

  return (
    <PageShell title={t("zonesHR.title")} showBack showPoweredByStrava={false}>
      <TrendZonesHR />
    </PageShell>
  );
}
