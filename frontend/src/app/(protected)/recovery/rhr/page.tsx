// src/app/(protected)/recovery/rhr/page.tsx  (alebo tvoja cesta k RHR detailu)
"use client";

import dynamic from "next/dynamic";
import AppHeader from "@/app/shared/components/ui/AppHeader";
import { PAGE_CONTAINER, PAGE_STACK } from "@/app/shared/ui/tokens/pageTokens";

const RHRDetailClient = dynamic(
  () => import("@/app/features/recovery/components/TrendRHR"),
  { ssr: false }
);

export default function Page() {
  return (
    <>
      <AppHeader title="Detail — Resting Heart Rate (RHR)" showBack container />

      <div className={PAGE_CONTAINER}>
        <div className={PAGE_STACK}>
          <RHRDetailClient />
        </div>
      </div>
    </>
  );
}