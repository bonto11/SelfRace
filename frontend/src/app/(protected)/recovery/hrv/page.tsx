// src/app/(protected)/recovery/hrv/page.tsx  (alebo tvoja cesta k HRV detailu)
"use client";

import dynamic from "next/dynamic";
import AppHeader from "@/app/shared/components/ui/AppHeader";
import { PAGE_CONTAINER, PAGE_STACK } from "@/app/shared/ui/tokens/pageTokens";

const HRVDetailClient = dynamic(
  () => import("@/app/features/recovery/components/TrendHRV"),
  { ssr: false }
);

export default function Page() {
  return (
    <>
      <AppHeader title="Detail — HRV" showBack container />

      <div className={PAGE_CONTAINER}>
        <div className={PAGE_STACK}>
          <HRVDetailClient />
        </div>
      </div>
    </>
  );
}