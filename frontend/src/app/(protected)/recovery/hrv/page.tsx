// src/app/(protected)/recovery/hrv/page.tsx
"use client";

import dynamic from "next/dynamic";
import ButtonBack from "@/shared/components/ui/ButtonBack";

const HRVDetailClient = dynamic(
  () => import("@/features/recovery/components/TrendHRV"),
  { ssr: false }
);

export default function Page() {
  return (
    <div className="max-w-screen-lg mx-auto px-3 overflow-x-hidden">
      <ButtonBack title="Detail - Hearth Rate Variability - HRV" />
      <div className="pt-3">
        <HRVDetailClient />
      </div>
    </div>
  );
}