// src/app/(protected)/coach/monthly/page.tsx
"use client";

import dynamic from "next/dynamic";
import PageShell from "@/app/shared/ui/components/PageShell";
import { useT } from "@/app/shared/i18n/useT";

const MonthlySummaryDetail = dynamic(
  () => import("@/app/features/coach/components/MonthlySummaryDetail"),
  { ssr: false }
);

export default function Page() {
  const t = useT();
  return (
    <PageShell
      title={t("monthlySummary.title") as any || "Mesačný prehľad"}
      showBack
      showPoweredByStrava
    >
      <MonthlySummaryDetail />
    </PageShell>
  );
}

