// src/app/(protected)/trends/bodyweight/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import TrendBodyWeight from "@/app/features/performance/components/TrendBodyWeight";
import { useT } from "@/app/shared/i18n/useT";

export default function Page() {
  const t = useT();

  return (
    <PageShell 
      title={t("performance.metrics.weightLabel")} 
      showBack 
      showPoweredByStrava={false}
    >
      <TrendBodyWeight />
    </PageShell>
  );
}
