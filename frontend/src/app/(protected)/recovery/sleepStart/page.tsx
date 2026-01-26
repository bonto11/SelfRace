// src/app/(protected)/recovery/sleepStart/page.tsx
"use client";

import dynamic from "next/dynamic";
import PageShell from "@/app/shared/ui/components/PageShell";

const SleepStartDetailClient = dynamic(
  () => import("@/app/features/recovery/components/TrendSleepStart"),
  { ssr: false }
);

export default function Page() {
  return (
    <PageShell title="Detail — Sleep Start" showBack>
      <SleepStartDetailClient />
    </PageShell>
  );
}
