// src/app/(protected)/recovery/sleepDuration/page.tsx
"use client";

import dynamic from "next/dynamic";
import AppHeader from "@/app/shared/components/ui/AppHeader";
import { PAGE_CONTAINER, PAGE_STACK } from "@/app/shared/ui/tokens/pageTokens";

const SleepDurationDetailClient = dynamic(
  () => import("@/app/features/recovery/components/TrendSleepDuration"),
  { ssr: false }
);

export default function Page() {
  return (
    <>
      <AppHeader title="Detail — Sleep Duration" showBack container />

      <div className={PAGE_CONTAINER}>
        <div className={PAGE_STACK}>
          <SleepDurationDetailClient />
        </div>
      </div>
    </>
  );
}