// src/app/(protected)/recovery/rhr/page.tsx
"use client";

import dynamic from "next/dynamic";
import { recoveryInfo } from "@/app/features/recovery/utils/recoveryWidget";
import PageShell from "@/app/shared/ui/components/PageShell";
import { useT } from "@/app/shared/i18n/useT";

const RHRDetailClient = dynamic(
  () => import("@/app/features/recovery/components/TrendRHR"),
  { ssr: false }
);

export default function Page() {
  const t = useT();
  return (
    <PageShell
      info={recoveryInfo(t, "rhr")}
      title={t("RHR.title")} showBack showPoweredByStrava={false}>
      <RHRDetailClient />
    </PageShell>
  );
}
