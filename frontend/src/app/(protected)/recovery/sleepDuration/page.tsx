// src/app/(protected)/recovery/sleepDuration/page.tsx
"use client";

import dynamic from "next/dynamic";
import PageShell from "@/app/shared/ui/components/PageShell";

const SleepDurationDetailClient = dynamic(
  () => import("@/app/features/recovery/components/TrendSleepDuration"),
  { ssr: false }
);

export default function Page() {
  return (
    <PageShell title="Detail — Sleep Duration" showBack>
      <SleepDurationDetailClient />
    </PageShell>
  );
}
