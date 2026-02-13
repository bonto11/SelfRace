// src/app/(protected)/recovery/sleepStart/page.tsx
"use client";

import dynamic from "next/dynamic";
import PageShell from "@/app/shared/ui/components/PageShell";
import { useT } from "@/app/shared/i18n/useT";

const SleepStartDetailClient = dynamic(
  () => import("@/app/features/recovery/components/TrendSleepStart"),
  { ssr: false }
);

export default function Page() {
  const t = useT();
  return (
    <PageShell title={t("sleepStart.title")} showBack showPoweredByStrava={false}>
      <SleepStartDetailClient />
    </PageShell>
  );
}
