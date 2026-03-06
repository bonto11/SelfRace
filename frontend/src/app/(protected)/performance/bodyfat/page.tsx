// src/app/(protected)/trends/bodyfat/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import TrendBodyFat from "@/app/features/performance/components/TrendBodyFat";
import { useT } from "@/app/shared/i18n/useT";

export default function Page() {
  const t = useT();

  return (
    <PageShell title={t("bodyFat.title")} showBack showPoweredByStrava={false}>
      <TrendBodyFat />
    </PageShell>
  );
}
