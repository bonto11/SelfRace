// src/app/(protected)/recovery/sleepDuration/page.tsx
"use client";

import dynamic from "next/dynamic";
import PageShell from "@/app/shared/ui/components/PageShell";
import { useT } from "@/app/shared/i18n/useT";

const SleepDurationDetailClient = dynamic(
  () => import("@/app/features/recovery/components/TrendSleepDuration"),
  { ssr: false }
);

export default function Page() {
  const t = useT();
  return (
    <PageShell title={t("sleepDuration.title")} showBack showPoweredByStrava={false}>
      <SleepDurationDetailClient />
    </PageShell>
  );
}
