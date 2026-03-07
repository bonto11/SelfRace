// src/app/(protected)/performance/zonesPaces/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import TrendZonesPaces from "@/app/features/performance/components/TrendZonesPaces";
import { useT } from "@/app/shared/i18n/useT";

export default function Page() {
  const t = useT();

  return (
    <PageShell title={t("zonesPaces.title")} showBack showPoweredByStrava={false}>
      <TrendZonesPaces />
    </PageShell>
  );
}
