// src/app/(protected)/recovery/sleepStart/page.tsx
"use client";

import dynamic from "next/dynamic";
import AppHeader from "@/app/shared/components/ui/AppHeader";
import { PAGE_CONTAINER, PAGE_STACK } from "@/app/shared/ui/tokens/pageTokens";

const SleepStartDetailClient = dynamic(
  () => import("@/app/features/recovery/components/TrendSleepStart"),
  { ssr: false }
);

export default function Page() {
  return (
    <>
      <AppHeader title="Detail — Sleep Start" showBack container />

      <div className={PAGE_CONTAINER}>
        <div className={PAGE_STACK}>
          <SleepStartDetailClient />
        </div>
      </div>
    </>
  );
}