// src/app/(protected)/recovery/hrv/page.tsx
"use client";

import dynamic from "next/dynamic";
import PageShell from "@/app/shared/ui/components/PageShell";
import { useT } from "@/app/shared/i18n/useT";

const HRVDetailClient = dynamic(
  () => import("@/app/features/recovery/components/TrendHRV"),
  { ssr: false }
);

export default function Page() {
  const t = useT();
  return (
    <PageShell title={t("HRV.title")} showBack showPoweredByStrava={false}>
      <HRVDetailClient />
    </PageShell>
  );
}
