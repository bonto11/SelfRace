// src/app/(protected)/recovery/readiness/page.tsx
"use client";

import dynamic from "next/dynamic";
import { recoveryInfo } from "@/app/features/recovery/utils/recoveryWidget";
import PageShell from "@/app/shared/ui/components/PageShell";
import { useT } from "@/app/shared/i18n/useT";

const ReadinessDetail = dynamic(
  () => import("@/app/features/recovery/components/ReadinessDetail"),
  { ssr: false }
);

export default function Page() {
  const t = useT();
  return (
    <PageShell
      info={recoveryInfo(t, "readiness")}
      title={t("readiness.detail.title") || "Pripravenosť na tréning"}
      showBack
      showPoweredByStrava={false}
    >
      <ReadinessDetail />
    </PageShell>
  );
}
