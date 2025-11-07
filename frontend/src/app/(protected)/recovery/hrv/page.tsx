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

      {/* izoluj obsah, aby nič z vnútra nepretieklo doprava */}
      <div className="pt-3 min-w-0">
        {/* 1px guard proti iOS canvas overflowu */}
        <div className="-mr-px">
          <HRVDetailClient />
        </div>
      </div>
    </div>
  );
}